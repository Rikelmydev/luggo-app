import { describe, expect, it } from 'vitest'
import { getModel } from '../data/catalog'
import { extensionQuote, kitListPrice, lateFeePerDay, periodPrice, priceFormula, quote, rentalDays } from './pricing'

// A tabela de preços da Luggo: o aluguel inteiro de uma mala, por dias e pelo peso que ela leva.
//             dias    10 kg (bordo)  23 kg (média)  32 kg (grande)
const TABLE: [number, number, number, number][] = [
  [1, 24.9, 34.9, 39.9], [2, 32.4, 44.07, 51.57], [3, 39.9, 53.23, 63.23], [4, 47.4, 62.4, 74.9],
  [5, 54.9, 71.57, 86.57], [6, 62.4, 80.73, 98.23], [7, 69.9, 89.9, 109.9], [8, 73.65, 96.15, 117.4],
  [9, 77.4, 102.4, 124.9], [10, 81.15, 108.65, 132.4], [11, 84.9, 114.9, 139.9], [12, 88.65, 121.15, 147.4],
  [13, 92.4, 127.4, 154.9], [14, 96.15, 133.65, 162.4], [15, 99.9, 139.9, 169.9], [16, 101.9, 142.57, 173.23],
  [17, 103.9, 145.23, 176.57], [18, 105.9, 147.9, 179.9], [19, 107.9, 150.57, 183.23], [20, 109.9, 153.23, 186.57],
  [21, 111.9, 155.9, 189.9], [22, 113.9, 158.57, 193.23], [23, 115.9, 161.23, 196.57], [24, 117.9, 163.9, 199.9],
  [25, 119.9, 166.57, 203.23], [26, 121.9, 169.23, 206.57], [27, 123.9, 171.9, 209.9], [28, 125.9, 174.57, 213.23],
  [29, 127.9, 177.23, 216.57], [30, 129.9, 179.9, 219.9],
]

describe('rentalDays', () => {
  it('conta as diárias entre retirada e devolução', () => {
    expect(rentalDays('2026-10-24', '2026-10-31')).toBe(7)
    expect(rentalDays('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('tabela de preços', () => {
  it.each(TABLE)('%i dias: bordo, média e grande batem com a tabela', (days, p, m, g) => {
    expect(periodPrice('bordo-rigida', 1, days)).toBe(p)
    expect(periodPrice('media-rigida', 1, days)).toBe(m)
    expect(periodPrice('grande-rigida', 1, days)).toBe(g)
  })

  it('cobra o mesmo pela expansível do mesmo tamanho', () => {
    expect(periodPrice('bordo-expansivel', 1, 7)).toBe(69.9)
    expect(periodPrice('grande-expansivel', 1, 30)).toBe(219.9)
  })

  it('multiplica pela quantidade', () => {
    expect(periodPrice('media-rigida', 3, 6)).toBe(242.19)
  })

  it('deixa os kits mais baratos que as malas avulsas em todo período', () => {
    for (const id of ['kit-casal', 'kit-familia']) {
      const kit = getModel(id)!
      for (let d = 1; d <= 30; d++) expect(periodPrice(id, 1, d)).toBeLessThan(kitListPrice(kit, d))
    }
    expect(periodPrice('kit-casal', 1, 7)).toBe(159.9)
    expect(kitListPrice(getModel('kit-casal')!, 7)).toBe(179.8)
    expect(periodPrice('kit-familia', 1, 7)).toBe(319.9)
    expect(kitListPrice(getModel('kit-familia')!, 7)).toBe(359.6)
  })
})

describe('quote', () => {
  it('soma aluguel, proteção e entrega', () => {
    const q = quote({
      items: [{ modelId: 'media-rigida', qty: 2 }],
      start: '2026-10-24',
      end: '2026-10-31',
      protection: true,
      delivery: true,
    })
    expect(q.days).toBe(7)
    expect(q.lines[0].unit).toBe(89.9)
    expect(q.rentalSubtotal).toBe(179.8)
    expect(q.discount).toBe(0)
    expect(q.protection).toBe(42) // 2 malas x 7 dias x R$ 3
    expect(q.delivery).toBe(24.9)
    expect(q.total).toBe(246.7)
  })

  it('conta cada mala do kit na proteção', () => {
    const q = quote({ items: [{ modelId: 'kit-familia', qty: 1 }], start: '2026-10-24', end: '2026-10-27', protection: true, delivery: false })
    expect(q.units).toBe(4)
    expect(q.protection).toBe(36)
  })

  it('não cobra entrega sem itens', () => {
    expect(quote({ items: [], start: '2026-10-24', end: '2026-10-27', protection: false, delivery: true }).delivery).toBe(0)
  })
})

describe('extensão e atraso', () => {
  it('estende pela diferença da tabela', () => {
    // 7 dias de média = R$ 89,90; 9 dias = R$ 102,40: os 2 dias a mais custam R$ 12,50.
    expect(extensionQuote([{ modelId: 'media-rigida', qty: 1 }], 7, 2, false)).toBe(12.5)
    expect(extensionQuote([{ modelId: 'media-rigida', qty: 1 }], 7, 2, true)).toBe(18.5)
  })

  it('cobra o preço de 1 dia com 20% a mais por dia de atraso', () => {
    expect(lateFeePerDay([{ modelId: 'bordo-rigida', qty: 1 }])).toBe(29.88)
  })
})

describe('conta por extenso', () => {
  it('mostra quantidade, diárias e o preço de cada uma', () => {
    expect(priceFormula('media-rigida', 1, 6)).toBe('1 mala por 6 diárias')
    expect(priceFormula('media-rigida', 3, 6)).toMatch(/^3 malas por 6 diárias \(R\$\s80,73 cada\)$/)
    expect(priceFormula('kit-casal', 2, 7)).toMatch(/^2 kits por 7 diárias/)
  })
})
