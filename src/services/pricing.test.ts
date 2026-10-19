import { describe, expect, it } from 'vitest'
import { discountFor, extensionQuote, lateFeePerDay, periodPrice, quote, rentalDays } from './pricing'

describe('rentalDays', () => {
  it('conta as diárias entre retirada e devolução', () => {
    expect(rentalDays('2026-10-24', '2026-10-31')).toBe(7)
    expect(rentalDays('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('discountFor', () => {
  it('aplica o desconto progressivo', () => {
    expect(discountFor(6)).toBe(0)
    expect(discountFor(7)).toBe(0.1)
    expect(discountFor(13)).toBe(0.1)
    expect(discountFor(14)).toBe(0.2)
  })
})

describe('quote', () => {
  it('calcula aluguel, desconto, proteção e entrega', () => {
    const q = quote({
      items: [{ modelId: 'media-rigida', qty: 2 }],
      start: '2026-10-24',
      end: '2026-10-31',
      protection: true,
      delivery: true,
    })
    expect(q.days).toBe(7)
    expect(q.rentalSubtotal).toBe(252) // 18 x 2 x 7
    expect(q.discount).toBe(25.2) // 10%
    expect(q.protection).toBe(42) // 3 x 2 malas x 7
    expect(q.delivery).toBe(24.9)
    expect(q.total).toBe(293.7)
  })

  it('conta cada mala do kit na proteção', () => {
    const q = quote({ items: [{ modelId: 'kit-familia', qty: 1 }], start: '2026-11-01', end: '2026-11-04', protection: true, delivery: false })
    expect(q.units).toBe(4)
    expect(q.rentalSubtotal).toBe(186) // 62 x 3
    expect(q.protection).toBe(36) // 3 x 4 x 3
    expect(q.total).toBe(222)
  })

  it('não cobra entrega sem itens', () => {
    expect(quote({ items: [], start: '2026-11-01', end: '2026-11-04', protection: false, delivery: true }).total).toBe(0)
  })
})

describe('extensões e atrasos', () => {
  it('estende pela diária cheia, sem desconto', () => {
    expect(extensionQuote([{ modelId: 'bordo-rigida', qty: 1 }], 2, false)).toBe(28)
    expect(extensionQuote([{ modelId: 'bordo-rigida', qty: 1 }], 2, true)).toBe(34)
  })
  it('cobra 20% a mais por dia de atraso', () => {
    expect(lateFeePerDay([{ modelId: 'grande-rigida', qty: 1 }])).toBe(26.4)
  })
  it('mostra o preço do período com desconto', () => {
    expect(periodPrice('media-rigida', 1, 14)).toBe(201.6)
  })
})
