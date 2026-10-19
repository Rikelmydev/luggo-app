// Números do painel da equipe, calculados a partir dos pedidos e do estoque.
import { MODELS, getModel } from '../data/catalog'
import { addDays, fromISO, todayISO, toISO, type ISODate } from '../lib/dates'
import { cents } from '../lib/format'
import type { Order, Unit } from '../domain/types'
import { busyRange, holdsUnits } from './availability'

const isPaid = (o: Order) => o.payment.status === 'aprovado' && o.status !== 'cancelado'

/** Segunda-feira da semana do dia. */
export function weekStart(iso: ISODate): ISODate {
  const d = fromISO(iso)
  const shift = (d.getDay() + 6) % 7
  return addDays(iso, -shift)
}

export interface Point { key: string; label: string; value: number }

export function revenueByWeek(orders: Order[], weeks = 10, today = todayISO()): Point[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(first, i * 7)
    return { key: start, label: `${start.slice(8, 10)}/${start.slice(5, 7)}`, value: 0 }
  })
  const add = (when: string | undefined, amount: number) => {
    if (!when) return
    const day = toISO(new Date(when))
    const idx = buckets.findIndex((b, i) => day >= b.key && (i === buckets.length - 1 || day < buckets[i + 1].key))
    if (idx >= 0 && day <= today) buckets[idx].value = cents(buckets[idx].value + amount)
  }
  for (const o of orders) {
    if (!isPaid(o)) continue
    add(o.payment.paidAt, o.price.total)
    for (const e of o.extensions) add(e.payment.paidAt, e.amount)
  }
  return buckets
}

/** Parte do estoque ativo que está com cliente (ou reservada) em cada dia. */
export function occupancy(units: Unit[], orders: Order[], from: ISODate, days: number): Point[] {
  const active = units.filter((u) => !u.maintenance)
  const total = active.length || 1
  const out: Point[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i)
    const busy = new Set<string>()
    for (const o of orders) {
      if (!holdsUnits(o) || o.status === 'concluido') continue
      if (day < o.start || day > o.end) continue
      for (const it of o.items) it.unitIds.forEach((id) => busy.add(id))
    }
    const n = active.filter((u) => busy.has(u.id)).length
    out.push({ key: day, label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, value: Math.round((n / total) * 100) })
  }
  return out
}

export function rentalsPerModel(units: Unit[], orders: Order[]): (Point & { units: number; rentals: number })[] {
  return MODELS.filter((m) => m.kind !== 'kit').map((m) => {
    const ids = new Set(units.filter((u) => u.modelId === m.id).map((u) => u.id))
    let rentals = 0
    for (const o of orders) {
      if (o.status === 'cancelado' || o.status === 'aguardando_pagamento') continue
      for (const it of o.items) rentals += it.unitIds.filter((id) => ids.has(id)).length
    }
    const avg = ids.size ? Math.round((rentals / ids.size) * 10) / 10 : 0
    return { key: m.id, label: m.name, value: avg, units: ids.size, rentals }
  })
}

export function kpis(units: Unit[], orders: Order[], today = todayISO()) {
  const month = today.slice(0, 7)
  const paidThisMonth = orders.filter((o) => isPaid(o) && o.payment.paidAt?.slice(0, 7) === month)
  const revenue = cents(paidThisMonth.reduce((s, o) => s + o.price.total, 0) + orders.flatMap((o) => o.extensions).filter((e) => e.payment.paidAt?.slice(0, 7) === month).reduce((s, e) => s + e.amount, 0))
  const active = orders.filter((o) => o.status === 'confirmado' || o.status === 'com_cliente').length
  const occ = occupancy(units, orders, today, 30)
  const occAvg = Math.round(occ.reduce((s, p) => s + p.value, 0) / occ.length)
  const ticket = paidThisMonth.length ? cents(paidThisMonth.reduce((s, o) => s + o.price.total, 0) / paidThisMonth.length) : 0
  return { revenue, active, occAvg, ticket, ordersThisMonth: paidThisMonth.length }
}

export type UnitState = 'livre' | 'reservada' | 'com_cliente' | 'higienizacao' | 'manutencao'

export const UNIT_STATE_INFO: Record<UnitState, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = {
  livre: { label: 'Livre', tone: 'ok' },
  reservada: { label: 'Reservada hoje', tone: 'info' },
  com_cliente: { label: 'Com cliente', tone: 'info' },
  higienizacao: { label: 'Higienização', tone: 'muted' },
  manutencao: { label: 'Manutenção', tone: 'bad' },
}

export function unitState(unit: Unit, orders: Order[], today = todayISO()): { state: UnitState; order?: Order; next?: Order; rentals: number } {
  const mine = orders.filter((o) => o.status !== 'cancelado' && o.items.some((i) => i.unitIds.includes(unit.id)))
  const rentals = mine.filter((o) => o.status !== 'aguardando_pagamento').length
  const next = mine.filter((o) => o.start > today && holdsUnits(o)).sort((a, b) => (a.start < b.start ? -1 : 1))[0]
  if (unit.maintenance) return { state: 'manutencao', next, rentals }
  const current = mine.find((o) => holdsUnits(o) && o.status !== 'concluido' && today >= busyRange(o.start, o.end)[0] && today <= busyRange(o.start, o.end)[1])
  if (!current) return { state: 'livre', next, rentals }
  if (current.status === 'com_cliente') return { state: 'com_cliente', order: current, next, rentals }
  if (current.status === 'devolvido' || today > current.end) return { state: 'higienizacao', order: current, next, rentals }
  return { state: 'reservada', order: current, next, rentals }
}

export function todayBoard(orders: Order[], today = todayISO()) {
  const live = orders.filter((o) => o.status !== 'cancelado')
  return {
    outgoing: live.filter((o) => o.status === 'confirmado' && o.start <= today),
    returning: live.filter((o) => o.status === 'com_cliente' && o.end === today),
    late: live.filter((o) => o.status === 'com_cliente' && o.end < today),
    cleaning: live.filter((o) => o.status === 'devolvido'),
    upcoming: live.filter((o) => o.status === 'confirmado' && o.start > today && o.start <= addDays(today, 3)),
  }
}

export const modelName = (id: string) => getModel(id)?.name ?? id
