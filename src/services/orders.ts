// Pedidos: criar, pagar, cancelar, estender e (na área da equipe) avançar o status.
// Todas as funções são assíncronas, como seriam com um backend.
import { BUSINESS } from '../config/business'
import { COLOR_INFO, getModel, type Color } from '../data/catalog'
import { makeCode } from '../data/seed'
import { addDays, diffDays, fromISO, todayISO, type ISODate } from '../lib/dates'
import type { ContactMessage, Customer, Fulfillment, Order, OrderStatus, PaymentMethod, Unit } from '../domain/types'
import { allocate, availableCount, canExtend, dailyAvailability, holdsUnits } from './availability'
import { createPixCharge } from './payments'
import { extensionQuote, quote, rentalDays } from './pricing'
import { delay, readDB, updateDB } from './storage'

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
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const ctx = () => {
  const db = readDB()
  return { units: db.units, orders: db.orders, now: new Date() }
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
    .orders.filter((o) => o.source === 'site')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getOrder(code: string): Promise<Order | undefined> {
  await delay()
  return readDB().orders.find((o) => o.code === code.toUpperCase())
}

export async function findOrder(code: string, email: string): Promise<Order | undefined> {
  await delay()
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
  const items = []
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

  let code = makeCode()
  while (readDB().orders.some((o) => o.code === code)) code = makeCode()
  const pix = input.method === 'pix' ? createPixCharge(code, price.total) : undefined
  const createdAt = nowISO()
  const order: Order = {
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
  }
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

function patch(code: string, fn: (o: Order) => Order): Order {
  let updated: Order | undefined
  updateDB((db) => ({
    ...db,
    orders: db.orders.map((o) => {
      if (o.code !== code) return o
      updated = fn(o)
      return updated
    }),
  }))
  if (!updated) throw new Error('Pedido não encontrado')
  return updated
}

/** Resultado do pagamento (simulado nesta versão). */
export async function settlePayment(code: string, approved: boolean): Promise<Result<Order>> {
  await delay(900)
  const order = readDB().orders.find((o) => o.code === code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  if (order.status !== 'aguardando_pagamento') return { ok: true, value: order }
  if (!holdsUnits(order)) {
    patch(code, (o) => ({ ...o, payment: { ...o.payment, status: 'expirado' } }))
    return { ok: false, error: 'O prazo para pagamento acabou e as malas foram liberadas. Faça a reserva de novo.' }
  }
  if (!approved) {
    patch(code, (o) => ({ ...o, payment: { ...o.payment, status: 'recusado' } }))
    return { ok: false, error: 'Pagamento recusado pelo emissor do cartão. Tente outro cartão ou pague com Pix.' }
  }
  const at = nowISO()
  const paid = patch(code, (o) => ({
    ...o,
    status: 'confirmado',
    payment: { ...o.payment, status: 'aprovado', paidAt: at },
    history: [...o.history, { status: 'confirmado', at }],
  }))
  return { ok: true, value: paid }
}

/** Troca a forma de pagamento de um pedido que ainda não foi pago. */
export async function switchPayment(code: string, method: PaymentMethod): Promise<Order> {
  await delay(400)
  return patch(code, (o) => {
    const pix = method === 'pix' ? createPixCharge(o.code, o.price.total) : undefined
    return {
      ...o,
      payment: {
        ...o.payment,
        method,
        status: 'pendente',
        pixCode: pix?.code,
        expiresAt: pix?.expiresAt ?? new Date(Date.now() + operations.pixMinutes * 60_000).toISOString(),
      },
    }
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
  const order = readDB().orders.find((o) => o.code === code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  const check = canCancel(order)
  if (!check.ok) return { ok: false, error: check.reason ?? 'Não é possível cancelar.' }
  const at = nowISO()
  const done = patch(code, (o) => ({
    ...o,
    status: 'cancelado',
    history: [...o.history, { status: 'cancelado', at, note: check.refund ? 'Cancelado pelo cliente, valor estornado' : 'Cancelado antes do pagamento' }],
  }))
  return { ok: true, value: done }
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
  const order = readDB().orders.find((o) => o.code === code)
  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  const error = checkExtension(order, days)
  if (error) return { ok: false, error }
  const amount = extensionPrice(order, days)
  const at = nowISO()
  const updated = patch(code, (o) => ({
    ...o,
    end: addDays(o.end, days),
    extensions: [
      ...o.extensions,
      { days, amount, previousEnd: o.end, createdAt: at, payment: { method: 'pix', status: 'aprovado', amount, paidAt: at } },
    ],
  }))
  return { ok: true, value: updated }
}

/* ---------- Área da equipe ---------- */

export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; action: string }>> = {
  confirmado: { to: 'com_cliente', action: 'Marcar como entregue' },
  com_cliente: { to: 'devolvido', action: 'Registrar devolução' },
  devolvido: { to: 'concluido', action: 'Concluir higienização' },
}

export async function advanceOrder(code: string): Promise<Order> {
  await delay(300)
  return patch(code, (o) => {
    const next = NEXT_STATUS[o.status]
    if (!next) return o
    return { ...o, status: next.to, history: [...o.history, { status: next.to, at: nowISO() }] }
  })
}

export async function listUnits(): Promise<Unit[]> {
  await delay()
  return readDB().units
}

export async function setMaintenance(unitId: string, maintenance: boolean, note?: string): Promise<void> {
  await delay(300)
  updateDB((db) => ({
    ...db,
    units: db.units.map((u) => (u.id === unitId ? { ...u, maintenance, note: maintenance ? note : undefined } : u)),
  }))
}

export async function sendContact(msg: Omit<ContactMessage, 'id' | 'createdAt'>): Promise<ContactMessage> {
  await delay(700)
  const saved = { ...msg, id: makeCode().replace('LG', 'MSG-'), createdAt: nowISO() }
  updateDB((db) => ({ ...db, messages: [saved, ...db.messages] }))
  return saved
}

export const pickupDay = (order: Order) => order.start
export const returnDay = (order: Order) => order.end
export const cleaningUntil = (order: Order) => addDays(order.end, operations.cleaningDays)
