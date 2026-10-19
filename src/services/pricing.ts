import { BUSINESS } from '../config/business'
import { getModel, unitsPerItem } from '../data/catalog'
import { diffDays, type ISODate } from '../lib/dates'
import { cents } from '../lib/format'
import type { PriceBreakdown } from '../domain/types'

const { pricing } = BUSINESS

export interface QuoteItem {
  modelId: string
  qty: number
  colorLabel?: string
}

export interface QuoteInput {
  items: QuoteItem[]
  start: ISODate
  end: ISODate
  protection: boolean
  delivery: boolean
}

/** Diárias entre a retirada e a devolução (24 out a 31 out = 7 diárias). */
export const rentalDays = (start: ISODate, end: ISODate) => Math.max(0, diffDays(start, end))

export function discountFor(days: number): number {
  return pricing.discounts.find((d) => days >= d.fromDays)?.pct ?? 0
}

export function quote({ items, start, end, protection, delivery }: QuoteInput): PriceBreakdown {
  const days = rentalDays(start, end)
  let units = 0
  const lines = items.map((item) => {
    const model = getModel(item.modelId)
    if (!model) throw new Error(`Modelo desconhecido: ${item.modelId}`)
    units += unitsPerItem(model) * item.qty
    return {
      modelId: model.id,
      label: item.colorLabel ? `${model.name} ${item.colorLabel}` : model.name,
      qty: item.qty,
      days,
      daily: model.daily,
      subtotal: cents(model.daily * item.qty * days),
    }
  })
  const rentalSubtotal = cents(lines.reduce((s, l) => s + l.subtotal, 0))
  const discountPct = discountFor(days)
  const discount = cents(rentalSubtotal * discountPct)
  const protectionValue = protection ? cents(pricing.protectionPerDay * units * days) : 0
  const deliveryValue = delivery && items.length ? pricing.deliveryFee : 0
  return {
    days,
    units,
    lines,
    rentalSubtotal,
    discountPct,
    discount,
    protection: protectionValue,
    delivery: deliveryValue,
    total: cents(rentalSubtotal - discount + protectionValue + deliveryValue),
  }
}

/** Mais dias pedidos pelo site antes do fim do aluguel: diária cheia, sem desconto. */
export function extensionQuote(items: { modelId: string; qty: number }[], extraDays: number, protection: boolean): number {
  let total = 0
  let units = 0
  for (const item of items) {
    const model = getModel(item.modelId)
    if (!model) continue
    total += model.daily * item.qty * extraDays
    units += unitsPerItem(model) * item.qty
  }
  if (protection) total += pricing.protectionPerDay * units * extraDays
  return cents(total)
}

/** Atraso sem aviso: diária cheia + 20%. */
export function lateFeePerDay(items: { modelId: string; qty: number }[]): number {
  const daily = items.reduce((s, i) => s + (getModel(i.modelId)?.daily ?? 0) * i.qty, 0)
  return cents(daily * pricing.extraDayFactor)
}

/** Preço total de um modelo no período, já com o desconto progressivo. */
export function periodPrice(modelId: string, qty: number, days: number): number {
  const model = getModel(modelId)
  if (!model || days <= 0) return 0
  const gross = model.daily * qty * days
  return cents(gross - gross * discountFor(days))
}
