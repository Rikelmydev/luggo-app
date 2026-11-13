// Pedidos: criar, pagar, cancelar, estender e (na área da equipe) avançar o status.
// As regras rodam aqui; com Supabase, cada mudança é gravada (e conferida de novo) no banco.
import { BUSINESS } from '../config/business'
import { COLOR_INFO, getModel, type Color } from '../data/catalog'
import { makeCode } from '../data/seed'
import { addDays, diffDays, fromISO, todayISO, type ISODate } from '../lib/dates'
import type { ContactMessage, Customer, Fulfillment, Order, OrderStatus, PaymentMethod, Unit } from '../domain/types'
import { allocate, availableCount, canExtend, dailyAvailability, holdsUnits } from './availability'
import { createPixCharge } from './payments'
import { extensionQuote, quote, rentalDays } from './pricing'
import { reminderDue } from './reminders'
import * as remote from './remote'
import { delay, readDB, updateDB } from './storage'
import { REMOTE } from './supabase'

const { operations, pricing } = BUSINESS
const nowISO = () => new Date().toISOString()

export interface NewOrderItem {
  modelId: string
  color?: Color
  qty: number
}

export interface NewOrder {
  customer: Customer
  start: ISODate
  end: ISODate
  items: NewOrderItem[]
  fulfillment: Fulfillment
  protection: boolean
  method: PaymentMethod
  account?: Order['account']
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const ctx = () => {
  const db = readDB()
  // Com Supabase, as reservas dos outros chegam só como ocupação (sem dados pessoais).
  const known = new Set(db.orders.map((o) => o.code))
  const holds = (db.holds ?? []).filter((h) => !known.has(h.code))
  return { units: db.units, orders: [...db.orders, ...holds], now: new Date() }
}

/** A reserva é de quem está usando o site (e não um pedido de exemplo ou de outra pessoa)? */
export const isMine = (order: Order) => (REMOTE ? remote.isMineCode(order.code) : order.source === 'site')

const attempt = async (p: Promise<Order>): Promise<Result<Order>> => {
  try {
    return { ok: true, value: await p }
  } catch (e) {
    return { ok: false, error: remote.errorText(e) }
  }
}

/* ---------- Consultas síncronas (rápidas, usadas pelo catálogo e calendário) ---------- */

export function stockAvailable(modelId: string, color: Color | undefined, start: ISODate, end: ISODate): number {
  return availableCount(ctx(), modelId, color, start, end)
}

export function stockByDay(modelId: string, color: Color | undefined, days: ISODate[]): Record<ISODate, number> {
  return dailyAvailability(ctx(), modelId, color, days)
}

/** Primeiro dia possível para retirada: hoje na loja, amanhã com entrega. */
export function earliestStart(delivery = false): ISODate {
  return addDays(todayISO(), delivery ? operations.deliveryLeadDays : 0)
}

export function validatePeriod(start?: ISODate, end?: ISODate): string | null {
  if (!start || !end) return 'Escolha as datas de retirada e devolução.'
  if (start < todayISO()) return 'A retirada não pode ser no passado.'
  const days = rentalDays(start, end)
  if (days < pricing.minDays) return `O aluguel mínimo é de ${pricing.minDays} diárias.`
  if (days > operations.maxDays) return `Para mais de ${operations.maxDays} diárias, fale com a gente.`
  if (diffDays(todayISO(), start) > operations.maxAdvanceDays) return 'Ainda não abrimos reservas para essa data.'
  return null
}

/* ---------- Pedidos ---------- */

export async function listOrders(): Promise<Order[]> {
  await delay()
  return [...readDB().orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function listMyOrders(): Promise<Order[]> {
  await delay()
  return readDB()
    .orders.filter(isMine)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** A reserva ainda está valendo? Mala com o cliente conta mesmo depois do prazo. */
export function isActive(order: Order, now: Date = new Date()): boolean {
  if (order.status === 'com_cliente') return true
  const live = order.status === 'confirmado' || (order.status === 'aguardando_pagamento' && holdsUnits(order, now))
  return live && order.end >= todayISO(now)
}

/** Malas em reservas pagas e ainda abertas: somam com a reserva em montagem no botão Reservas. */
export function reservedCount(orders: Order[], now: Date = new Date()): number {
  return orders
    .filter((o) => isMine(o) && o.status !== 'aguardando_pagamento' && isActive(o, now))
    .reduce((n, o) => n + o.items.reduce((sum, i) => sum + i.qty, 0), 0)
}

export async function getOrder(code: string): Promise<Order | undefined> {
  await delay()
  const find = () => readDB().orders.find((o) => o.code === code.toUpperCase())
  if (find() || !REMOTE) return find()
  // Pode ter sido feita na conta em outro aparelho: busca de novo no banco.
  await remote.loadMine().catch(() => {})
  return find()
}

export async function findOrder(code: string, email: string): Promise<Order | undefined> {
  await delay()
  if (REMOTE) return remote.findOrder(code, email).catch(() => undefined)
  return readDB().orders.find((o) => o.code === code.trim().toUpperCase() && o.customer.email.toLowerCase() === email.trim().toLowerCase())
}

export async function createOrder(input: NewOrder): Promise<Result<Order>> {
  await delay(600)
  const periodError = validatePeriod(input.start, input.end)
  if (periodError) return { ok: false, error: periodError }
  if (!input.items.length) return { ok: false, error: 'Sua reserva está vazia.' }
  if (input.fulfillment.type === 'entrega' && input.start < earliestStart(true)) {
    return { ok: false, error: 'Para entrega em casa, a retirada precisa ser a partir de amanhã.' }
  }

  const c = ctx()
  const items: Order['items'] = []
  const taken: Order[] = []
  for (const item of input.items) {
    const model = getModel(item.modelId)
    if (!model) return { ok: false, error: 'Um dos itens não está mais no catálogo.' }
    // Considera também as malas já separadas para os itens anteriores deste pedido.
    const unitIds = allocate({ ...c, orders: [...c.orders, ...taken] }, model.id, item.color, item.qty, input.start, input.end)
    if (!unitIds) {
      const color = item.color ? ` ${COLOR_INFO[item.color].label}` : ''
      return { ok: false, error: `Não há ${model.name}${color} suficiente para essas datas. Ajuste a quantidade ou as datas.` }
    }
    items.push({ ...item, unitIds })
    taken.push({ ...placeholderOrder(input), items: [{ ...item, unitIds }] })
  }

  const price = quote({
    items: input.items.map((i) => ({ modelId: i.modelId, qty: i.qty, colorLabel: i.color ? COLOR_INFO[i.color].label : undefined })),
    start: input.start,
    end: input.end,
    protection: input.protection,
    delivery: input.fulfillment.type === 'entrega',
  })

  const build = (code: string): Order => {
    const pix = input.method === 'pix' ? createPixCharge(code, price.total) : undefined
    const createdAt = nowISO()
    return {
      code,
      createdAt,
      status: 'aguardando_pagamento',
      customer: { ...input.customer, email: input.customer.email.trim().toLowerCase() },
      start: input.start,
      end: input.end,
      items,
      fulfillment: input.fulfillment,
      protection: input.protection,
      price,
      payment: {
        method: input.method,
        status: 'pendente',
        amount: price.total,
        pixCode: pix?.code,
        // O cartão também segura as malas por 30 minutos enquanto o cliente paga.
        expiresAt: pix?.expiresAt ?? new Date(Date.now() + operations.pixMinutes * 60_000).toISOString(),
      },
      history: [{ status: 'aguardando_pagamento', at: createdAt }],
      extensions: [],
      source: 'site',
      ...(input.account ? { account: input.account } : {}),
    }
  }

  if (REMOTE) {
    // O banco confere de novo se as malas estão livres; um código repetido só pede outro.
    for (let tries = 0; ; tries++) {
      try {
        return { ok: true, value: await remote.placeOrder(build(makeCode())) }
      } catch (e) {
        if (remote.isCodeTaken(e) && tries < 3) continue
        return { ok: false, error: remote.errorText(e) }
      }
    }
  }
  let code = makeCode()
  while (readDB().orders.some((o) => o.code === code)) code = makeCode()
  const order = build(code)
  updateDB((db) => ({ ...db, orders: [order, ...db.orders] }))
  return { ok: true, value: order }
}

function placeholderOrder(input: NewOrder): Order {
  return {
    code: '__novo__',
    createdAt: nowISO(),
    status: 'confirmado',
    customer: input.customer,
    start: input.start,
    end: input.end,
    items: [],
    fulfillment: input.fulfillment,
    protection: false,
    price: { days: 0, units: 0, lines: [], rentalSubtotal: 0, discountPct: 0, discount: 0, protection: 0, delivery: 0, total: 0 },
    payment: { method: 'pix', status: 'aprovado', amount: 0 },
    history: [],
    extensions: [],
    source: 'site',
  }
}

/** Grava o pedido já alterado: no navegador ou, com Supabase, no banco (que confere a mudança). */
async function save(next: Order): Promise<Order> {
  if (REMOTE) return remote.saveOrder(next)
  updateDB((db) => ({ ...db, orders: db.orders.map((o) => (o.code === next.code ? next : o)) }))
  return next
}

const cached = (code: string) => readDB().orders.find((o) => o.code === code)

/** Resultado do pagamento (simulado nesta versão). */
export async function settlePayment(code: string, approved: boolean): Promise<Result<Order>> {
  await delay(900)
  const order = cached(code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  if (order.status !== 'aguardando_pagamento') return { ok: true, value: order }
  if (!holdsUnits(order)) {
    await save({ ...order, payment: { ...order.payment, status: 'expirado' } }).catch(() => {})
    return { ok: false, error: 'O prazo para pagamento acabou e as malas foram liberadas. Faça a reserva de novo.' }
  }
  if (!approved) {
    await save({ ...order, payment: { ...order.payment, status: 'recusado' } }).catch(() => {})
    return { ok: false, error: 'Pagamento recusado pelo emissor do cartão. Tente outro cartão ou pague com Pix.' }
  }
  const at = nowISO()
  return attempt(
    save({
      ...order,
      status: 'confirmado',
      payment: { ...order.payment, status: 'aprovado', paidAt: at },
      history: [...order.history, { status: 'confirmado', at }],
    }),
  )
}

/** Troca a forma de pagamento de um pedido que ainda não foi pago. */
export async function switchPayment(code: string, method: PaymentMethod): Promise<Order> {
  await delay(400)
  const o = cached(code)
  if (!o) throw new Error('Pedido não encontrado')
  const pix = method === 'pix' ? createPixCharge(o.code, o.price.total) : undefined
  return save({
    ...o,
    payment: {
      ...o.payment,
      method,
      status: 'pendente',
      pixCode: pix?.code,
      expiresAt: pix?.expiresAt ?? new Date(Date.now() + operations.pixMinutes * 60_000).toISOString(),
    },
  })
}

/** Horas até a retirada (meio-dia do dia da retirada como referência). */
export function hoursUntilStart(order: Order): number {
  const start = fromISO(order.start)
  start.setHours(12)
  return (start.getTime() - Date.now()) / 3_600_000
}

export function canCancel(order: Order): { ok: boolean; refund: boolean; reason?: string } {
  if (order.status === 'aguardando_pagamento') return { ok: true, refund: false }
  if (order.status !== 'confirmado') return { ok: false, refund: false, reason: 'Depois da retirada não é possível cancelar. Você pode devolver antes.' }
  const free = hoursUntilStart(order) >= operations.freeCancelHours
  return free
    ? { ok: true, refund: true }
    : { ok: false, refund: false, reason: `Cancelamento grátis só até ${operations.freeCancelHours}h antes da retirada. Fale com a gente pelo contato.` }
}

export async function cancelOrder(code: string): Promise<Result<Order>> {
  await delay(600)
  const order = cached(code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  const check = canCancel(order)
  if (!check.ok) return { ok: false, error: check.reason ?? 'Não é possível cancelar.' }
  const at = nowISO()
  return attempt(
    save({
      ...order,
      status: 'cancelado',
      history: [...order.history, { status: 'cancelado', at, note: check.refund ? 'Cancelado pelo cliente, valor estornado' : 'Cancelado antes do pagamento' }],
    }),
  )
}

export function extensionPrice(order: Order, days: number): number {
  return extensionQuote(order.items, days, order.protection)
}

export function checkExtension(order: Order, days: number): string | null {
  if (!['confirmado', 'com_cliente'].includes(order.status)) return 'Só dá para estender reservas confirmadas ou em andamento.'
  if (days < 1) return 'Escolha pelo menos 1 dia.'
  if (rentalDays(order.start, order.end) + days > operations.maxDays) return `O aluguel pode ter no máximo ${operations.maxDays} diárias.`
  if (!canExtend(ctx(), order, days)) return 'Essas malas já têm outra reserva logo depois. Dá para estender por menos dias.'
  return null
}

/** Estende o aluguel depois do pagamento (simulado) dos dias extras. */
export async function extendOrder(code: string, days: number): Promise<Result<Order>> {
  await delay(900)
  const order = cached(code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  const error = checkExtension(order, days)
  if (error) return { ok: false, error }
  const amount = extensionPrice(order, days)
  const at = nowISO()
  return attempt(
    save({
      ...order,
      end: addDays(order.end, days),
      returnReminder: undefined,
      extensions: [
        ...order.extensions,
        { days, amount, previousEnd: order.end, createdAt: at, payment: { method: 'pix', status: 'aprovado', amount, paidAt: at } },
      ],
    }),
  )
}

/** Dispara (simulado) os lembretes de devolução que venceram e devolve os pedidos avisados. */
export async function sendDueReminders(now: Date = new Date()): Promise<Order[]> {
  const at = now.toISOString()
  const sent: Order[] = []
  for (const o of readDB().orders.filter((o) => isMine(o) && reminderDue(o, now))) {
    try {
      sent.push(await save({ ...o, returnReminder: { sentAt: at, to: o.customer.email } }))
    } catch {
      /* sem conexão: tenta de novo no próximo minuto */
    }
  }
  return sent
}

/* ---------- Área da equipe ---------- */

export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; action: string }>> = {
  confirmado: { to: 'com_cliente', action: 'Marcar como entregue' },
  com_cliente: { to: 'devolvido', action: 'Registrar devolução' },
  devolvido: { to: 'concluido', action: 'Concluir higienização' },
}

export async function advanceOrder(code: string): Promise<Order> {
  await delay(300)
  const o = cached(code)
  if (!o) throw new Error('Pedido não encontrado')
  const next = NEXT_STATUS[o.status]
  if (!next) return o
  return save({ ...o, status: next.to, history: [...o.history, { status: next.to, at: nowISO() }] })
}

export async function listUnits(): Promise<Unit[]> {
  await delay()
  return readDB().units
}

export async function setMaintenance(unitId: string, maintenance: boolean, note?: string): Promise<void> {
  await delay(300)
  if (REMOTE) return remote.setMaintenance(unitId, maintenance, note)
  updateDB((db) => ({
    ...db,
    units: db.units.map((u) => (u.id === unitId ? { ...u, maintenance, note: maintenance ? note : undefined } : u)),
  }))
}

export async function sendContact(msg: Omit<ContactMessage, 'id' | 'createdAt'>): Promise<ContactMessage> {
  await delay(700)
  const saved = { ...msg, id: makeCode().replace('LG', 'MSG-'), createdAt: nowISO() }
  if (REMOTE) await remote.sendMessage(saved)
  else updateDB((db) => ({ ...db, messages: [saved, ...db.messages] }))
  return saved
}

export const pickupDay = (order: Order) => order.start
export const returnDay = (order: Order) => order.end
export const cleaningUntil = (order: Order) => addDays(order.end, operations.cleaningDays)
