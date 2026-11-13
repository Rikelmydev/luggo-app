// Ponte com o banco no Supabase: carrega o que cada pessoa pode ver para a cópia em
// storage.ts, grava as mudanças pelas funções do banco e escuta as atualizações ao vivo.
// O esquema e as regras de acesso ficam em supabase/schema.sql.
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ContactMessage, Order, Unit } from '../domain/types'
import { kv, readDB, writeDB } from './storage'
import { sb } from './supabase'

/* ---------- Pedidos deste navegador ---------- */

// O banco devolve uma chave secreta para cada reserva feita aqui; com ela o cliente vê e
// mexe na própria reserva mesmo sem conta.
const KEYS = 'luggo:chaves:v1'
type Ref = { code: string; key: string }

function refs(): Ref[] {
  try {
    return JSON.parse(kv.get(KEYS) ?? '[]') as Ref[]
  } catch {
    return []
  }
}

function remember(code: string, key: string) {
  const all = refs().filter((r) => r.code !== code)
  kv.set(KEYS, JSON.stringify([...all, { code, key }]))
}

const keyFor = (code: string) => refs().find((r) => r.code === code)?.key ?? null

const mine = new Set<string>()
/** A reserva é desta pessoa (feita neste navegador ou na conta dela)? */
export const isMineCode = (code: string) => mine.has(code)

/* ---------- Cópia local ---------- */

let staff = false

type HoldRow = { code: string; status: Order['status']; start_date: string; end_date: string; unit_ids: string[]; expires_at: string | null }
type UnitRow = { id: string; model_id: string; color: Unit['color']; acquired_at: string; maintenance: boolean; note: string | null }

const toUnit = (r: UnitRow): Unit => ({ id: r.id, modelId: r.model_id, color: r.color, acquiredAt: r.acquired_at, maintenance: r.maintenance, note: r.note ?? undefined })

// Só o que a disponibilidade usa; o resto do pedido de outra pessoa não sai do banco.
const toHold = (r: HoldRow): Order =>
  ({
    code: r.code,
    status: r.status,
    start: r.start_date,
    end: r.end_date,
    items: [{ modelId: '', qty: r.unit_ids.length, unitIds: r.unit_ids }],
    payment: { method: 'pix', status: 'pendente', amount: 0, expiresAt: r.expires_at ?? undefined },
    source: 'site',
  }) as unknown as Order

function commit(patch: Partial<ReturnType<typeof readDB>>) {
  writeDB({ ...readDB(), ...patch })
}

function upsert(order: Order) {
  const db = readDB()
  const exists = db.orders.some((o) => o.code === order.code)
  commit({ orders: exists ? db.orders.map((o) => (o.code === order.code ? order : o)) : [order, ...db.orders] })
}

export async function loadPublic() {
  const [units, holds] = await Promise.all([sb().from('units').select('*'), sb().from('holds').select('*')])
  if (units.error) throw units.error
  if (holds.error) throw holds.error
  commit({ units: (units.data as UnitRow[]).map(toUnit), holds: (holds.data as HoldRow[]).map(toHold) })
}

export async function loadMine() {
  const { data, error } = await sb().rpc('my_orders', { p_refs: refs() })
  if (error) throw error
  const rows = data as { data: Order; key: string }[]
  mine.clear()
  for (const r of rows) {
    mine.add(r.data.code)
    remember(r.data.code, r.key)
  }
  if (staff) {
    // A equipe já tem todos os pedidos; só marca quais são dela.
    commit({})
    return
  }
  commit({ orders: rows.map((r) => r.data).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) })
}

async function loadAll() {
  const { data, error } = await sb().from('orders').select('data').order('created_at', { ascending: false })
  if (error) throw error
  commit({ orders: (data as { data: Order }[]).map((r) => r.data) })
}

/* ---------- Ao vivo ---------- */

let publicChannel: RealtimeChannel | null = null
let staffChannel: RealtimeChannel | null = null

function debounce(fn: () => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  return () => {
    clearTimeout(t)
    t = setTimeout(fn, ms)
  }
}

const refreshPublic = debounce(() => {
  loadPublic().catch(() => {})
  loadMine().catch(() => {})
}, 400)
const refreshAll = debounce(() => loadAll().catch(() => {}), 400)

/** Primeira carga do site; depois mantém o estoque em dia sozinho. */
export async function bootstrap() {
  await Promise.all([loadPublic(), loadMine()])
  publicChannel ??= sb()
    .channel('ocupacao')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'holds' }, refreshPublic)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, refreshPublic)
    .subscribe()
  // Plano B para quando a conexão ao vivo cair: confere de novo a cada minuto e ao voltar para a aba.
  setInterval(refreshPublic, 60_000)
  window.addEventListener('focus', refreshPublic)
}

/** Entra no modo equipe: confirma no banco e passa a receber todos os pedidos ao vivo. */
export async function enterStaff(): Promise<boolean> {
  const { data, error } = await sb().rpc('is_staff')
  if (error) throw error
  if (!data) return false
  staff = true
  await loadAll()
  staffChannel ??= sb()
    .channel('equipe')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshAll)
    .subscribe()
  return true
}

export async function leaveStaff() {
  staff = false
  if (staffChannel) await sb().removeChannel(staffChannel)
  staffChannel = null
  await loadMine()
}

/* ---------- Gravações ---------- */

const MESSAGES: Record<string, string> = {
  LUGGO_CONFLITO: 'Essas malas acabaram de ser reservadas por outra pessoa. Confira as datas e tente de novo.',
  LUGGO_DATAS: 'Confira as datas da reserva.',
  LUGGO_EXPIRADO: 'O prazo para pagamento acabou e as malas foram liberadas. Faça a reserva de novo.',
  LUGGO_SEM_ACESSO: 'Você não tem acesso a essa reserva.',
  LUGGO_NAO_ENCONTRADO: 'Pedido não encontrado.',
  LUGGO_INVALIDO: 'Não foi possível salvar essa mudança na reserva.',
}

/** Mensagem que a pessoa entende para um erro do banco (ou da conexão). */
export function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k))
  return code ? MESSAGES[code] : 'Não conseguimos falar com o servidor. Confira a internet e tente de novo.'
}

export const isCodeTaken = (e: unknown) => e instanceof Error && e.message.includes('LUGGO_CODIGO')

export async function placeOrder(order: Order): Promise<Order> {
  const { data, error } = await sb().rpc('place_order', { p_order: order })
  if (error) {
    // O estoque mudou desde a última carga: atualiza para a próxima tentativa.
    if (error.message.includes('LUGGO_CONFLITO')) refreshPublic()
    throw new Error(error.message)
  }
  const { order: saved, key } = data as { order: Order; key: string }
  remember(saved.code, key)
  mine.add(saved.code)
  upsert(saved)
  refreshPublic()
  return saved
}

export async function saveOrder(order: Order): Promise<Order> {
  const { data, error } = await sb().rpc('save_order', { p_code: order.code, p_key: keyFor(order.code), p_data: order })
  if (error) throw new Error(error.message)
  const saved = data as Order
  upsert(saved)
  refreshPublic()
  return saved
}

export async function findOrder(code: string, email: string): Promise<Order | undefined> {
  const { data, error } = await sb().rpc('find_order', { p_code: code, p_email: email })
  if (error) throw error
  const row = (data as { data: Order; key: string }[])[0]
  if (!row) return undefined
  remember(row.data.code, row.key)
  mine.add(row.data.code)
  upsert(row.data)
  return row.data
}

export async function setMaintenance(unitId: string, maintenance: boolean, note?: string) {
  const { error } = await sb().from('units').update({ maintenance, note: maintenance ? note ?? null : null }).eq('id', unitId)
  if (error) throw error
  await loadPublic()
}

export async function sendMessage(msg: ContactMessage) {
  const { error } = await sb().from('messages').insert({ id: msg.id, data: msg })
  if (error) throw error
}

export async function resetDemo(units: Unit[], orders: Order[]) {
  const { error } = await sb().rpc('reset_demo', { p_units: units, p_orders: orders })
  if (error) throw error
  await Promise.all([loadPublic(), staff ? loadAll() : loadMine()])
}
