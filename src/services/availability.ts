import { BUSINESS } from '../config/business'
import { getModel, type Color } from '../data/catalog'
import { addDays, overlaps, type ISODate } from '../lib/dates'
import type { Order, Unit } from '../domain/types'

const CLEANING = BUSINESS.operations.cleaningDays

/** O pedido ainda segura malas? Pix vencido e pedidos cancelados liberam o estoque. */
export function holdsUnits(order: Order, now: Date = new Date()): boolean {
  if (order.status === 'cancelado') return false
  if (order.status === 'aguardando_pagamento') {
    const exp = order.payment.expiresAt
    return !exp || new Date(exp).getTime() > now.getTime()
  }
  return true
}

/** Período em que a mala fica fora do estoque: do início até o fim da higienização. */
export function busyRange(start: ISODate, end: ISODate): [ISODate, ISODate] {
  return [start, addDays(end, CLEANING)]
}

export interface AvailabilityContext {
  units: Unit[]
  orders: Order[]
  now?: Date
  /** Ignora este pedido (para estender o próprio aluguel). */
  excludeCode?: string
}

/** Malas livres no período inteiro, contando a higienização depois da devolução. */
export function freeUnits(
  ctx: AvailabilityContext,
  modelId: string,
  color: Color | undefined,
  start: ISODate,
  end: ISODate,
): Unit[] {
  const [s, e] = busyRange(start, end)
  const blocked = new Set<string>()
  for (const order of ctx.orders) {
    if (order.code === ctx.excludeCode || !holdsUnits(order, ctx.now)) continue
    const [os, oe] = busyRange(order.start, order.end)
    if (!overlaps(s, e, os, oe)) continue
    for (const item of order.items) item.unitIds.forEach((id) => blocked.add(id))
  }
  return ctx.units.filter(
    (u) => u.modelId === modelId && !u.maintenance && (!color || u.color === color) && !blocked.has(u.id),
  )
}

/** Quantos itens do modelo (ou kits completos) cabem no período. */
export function availableCount(
  ctx: AvailabilityContext,
  modelId: string,
  color: Color | undefined,
  start: ISODate,
  end: ISODate,
): number {
  const model = getModel(modelId)
  if (!model) return 0
  if (model.contains) {
    return Math.min(
      ...model.contains.map((c) => Math.floor(freeUnits(ctx, c.modelId, undefined, start, end).length / c.qty)),
    )
  }
  return freeUnits(ctx, modelId, color, start, end).length
}

/** Disponibilidade de cada dia, para pintar o calendário. */
export function dailyAvailability(
  ctx: AvailabilityContext,
  modelId: string,
  color: Color | undefined,
  days: ISODate[],
): Record<ISODate, number> {
  const out: Record<ISODate, number> = {}
  // Um dia só serve de retirada se a mala estiver livre nele (sem contar a higienização da própria reserva).
  for (const d of days) out[d] = availableCount(ctx, modelId, color, d, addDays(d, -CLEANING))
  return out
}

/**
 * Separa as malas físicas de um item. Prefere as menos usadas, para o desgaste
 * ficar distribuído no estoque (rodízio).
 */
export function allocate(
  ctx: AvailabilityContext,
  modelId: string,
  color: Color | undefined,
  qty: number,
  start: ISODate,
  end: ISODate,
): string[] | null {
  const model = getModel(modelId)
  if (!model) return null
  const usage = new Map<string, number>()
  for (const o of ctx.orders) if (o.status !== 'cancelado') for (const it of o.items) for (const id of it.unitIds) usage.set(id, (usage.get(id) ?? 0) + 1)
  const pick = (mId: string, c: Color | undefined, n: number) => {
    const free = freeUnits(ctx, mId, c, start, end).sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0) || a.id.localeCompare(b.id))
    return free.length >= n ? free.slice(0, n).map((u) => u.id) : null
  }
  if (model.contains) {
    const ids: string[] = []
    for (const c of model.contains) {
      const got = pick(c.modelId, undefined, c.qty * qty)
      if (!got) return null
      ids.push(...got)
    }
    return ids
  }
  return pick(modelId, color, qty)
}

/** As mesmas malas continuam livres para estender o aluguel? */
export function canExtend(ctx: AvailabilityContext, order: Order, extraDays: number): boolean {
  const from = addDays(order.end, 1)
  const to = addDays(order.end, extraDays)
  const [s, e] = busyRange(from, to)
  const mine = new Set(order.items.flatMap((i) => i.unitIds))
  return !ctx.orders.some((o) => {
    if (o.code === order.code || !holdsUnits(o, ctx.now)) return false
    const [os, oe] = busyRange(o.start, o.end)
    return overlaps(s, e, os, oe) && o.items.some((i) => i.unitIds.some((id) => mine.has(id)))
  })
}
