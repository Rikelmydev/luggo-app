import { BUSINESS } from '../config/business'
import { getModel, unitsPerItem, type Model } from '../data/catalog'
import { diffDays, type ISODate } from '../lib/dates'
import { cents, money, plural } from '../lib/format'
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

/** Pontos da tabela: (dias, preço do período inteiro). */
export type PriceTable = readonly (readonly [number, number])[]

/** Diárias entre a retirada e a devolução (24 out a 31 out = 7 diárias). */
export const rentalDays = (start: ISODate, end: ISODate) => Math.max(0, diffDays(start, end))

/** A tabela do kit, ou a do tamanho da mala. */
export const priceTable = (model: Model): PriceTable => model.prices ?? pricing.table[model.size]

/**
 * Preço do período pela tabela. Entre dois pontos marcados o preço sobe em linha reta
 * (é assim que a tabela de 1 a 30 dias foi montada); depois do último, segue o mesmo ritmo.
 */
export function tablePrice(table: PriceTable, days: number): number {
  if (days <= 0) return 0
  const [d0, p0] = table[0]
  if (days <= d0) return cents((p0 * days) / d0)
  for (let i = 1; i < table.length; i++) {
    const [a, pa] = table[i - 1]
    const [b, pb] = table[i]
    if (days <= b || i === table.length - 1) return cents(pa + ((pb - pa) * (days - a)) / (b - a))
  }
  return cents(p0)
}

/** Preço de uma quantidade de malas (ou kits) pelo período inteiro. */
export function periodPrice(modelId: string, qty: number, days: number): number {
  const model = getModel(modelId)
  if (!model || days <= 0) return 0
  return cents(tablePrice(priceTable(model), days) * qty)
}

/** Quanto as malas do kit custariam alugadas separadas, no mesmo período. */
export function kitListPrice(model: Model, days: number): number {
  return cents((model.contains ?? []).reduce((sum, c) => sum + periodPrice(c.modelId, c.qty, days), 0))
}

export function quote({ items, start, end, protection, delivery }: QuoteInput): PriceBreakdown {
  const days = rentalDays(start, end)
  let units = 0
  const lines = items.map((item) => {
    const model = getModel(item.modelId)
    if (!model) throw new Error(`Modelo desconhecido: ${item.modelId}`)
    units += unitsPerItem(model) * item.qty
    const unit = periodPrice(model.id, 1, days)
    return {
      modelId: model.id,
      label: item.colorLabel ? `${model.name} ${item.colorLabel}` : model.name,
      qty: item.qty,
      days,
      unit,
      subtotal: cents(unit * item.qty),
    }
  })
  const rentalSubtotal = cents(lines.reduce((s, l) => s + l.subtotal, 0))
  const protectionValue = protection ? cents(pricing.protectionPerDay * units * days) : 0
  const deliveryValue = delivery && items.length ? pricing.deliveryFee : 0
  return {
    days,
    units,
    lines,
    rentalSubtotal,
    // O desconto por período já está dentro da tabela; os campos ficam para os pedidos antigos.
    discountPct: 0,
    discount: 0,
    protection: protectionValue,
    delivery: deliveryValue,
    total: cents(rentalSubtotal + protectionValue + deliveryValue),
  }
}

/** Mais dias pedidos pelo site antes do fim do aluguel: a diferença na tabela, mais a proteção dos dias novos. */
export function extensionQuote(items: { modelId: string; qty: number }[], currentDays: number, extraDays: number, protection: boolean): number {
  let total = 0
  let units = 0
  for (const item of items) {
    const model = getModel(item.modelId)
    if (!model) continue
    total += periodPrice(model.id, item.qty, currentDays + extraDays) - periodPrice(model.id, item.qty, currentDays)
    units += unitsPerItem(model) * item.qty
  }
  if (protection) total += pricing.protectionPerDay * units * extraDays
  return cents(total)
}

/** Atraso sem aviso: o preço de 1 dia + 20%, por dia. */
export function lateFeePerDay(items: { modelId: string; qty: number }[]): number {
  const oneDay = items.reduce((s, i) => s + periodPrice(i.modelId, i.qty, 1), 0)
  return cents(oneDay * pricing.extraDayFactor)
}

/** A conta por extenso, para ninguém precisar fazer de cabeça: "3 malas por 6 diárias (R$ 80,73 cada)". */
export function priceFormula(modelId: string, qty: number, days: number, unit = periodPrice(modelId, 1, days)): string {
  const [one, many] = getModel(modelId)?.kind === 'kit' ? ['kit', 'kits'] : ['mala', 'malas']
  return `${plural(qty, one, many)} por ${plural(days, 'diária', 'diárias')}${qty > 1 ? ` (${money(unit)} cada)` : ''}`
}
