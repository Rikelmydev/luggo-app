import { describe, expect, it } from 'vitest'
import { allocate, availableCount, canExtend, dailyAvailability, freeUnits, holdsUnits } from './availability'
import type { Order, Unit } from '../domain/types'

const units: Unit[] = [
  { id: 'MR-01', modelId: 'media-rigida', color: 'laranja', acquiredAt: '2026-06-01', maintenance: false },
  { id: 'MR-02', modelId: 'media-rigida', color: 'azul', acquiredAt: '2026-06-01', maintenance: false },
  { id: 'MR-03', modelId: 'media-rigida', color: 'laranja', acquiredAt: '2026-06-01', maintenance: true },
  { id: 'GR-01', modelId: 'grande-rigida', color: 'grafite', acquiredAt: '2026-06-01', maintenance: false },
  { id: 'GR-02', modelId: 'grande-rigida', color: 'azul', acquiredAt: '2026-06-01', maintenance: false },
  { id: 'BR-01', modelId: 'bordo-rigida', color: 'laranja', acquiredAt: '2026-06-01', maintenance: false },
  { id: 'BR-02', modelId: 'bordo-rigida', color: 'azul', acquiredAt: '2026-06-01', maintenance: false },
]

function order(code: string, start: string, end: string, unitIds: string[], extra: Partial<Order> = {}): Order {
  return {
    code,
    createdAt: '2026-10-01T10:00:00',
    status: 'confirmado',
    customer: { name: 'Teste', email: 't@example.com', phone: '11999999999' },
    start,
    end,
    items: [{ modelId: 'media-rigida', qty: unitIds.length, unitIds }],
    fulfillment: { type: 'loja' },
    protection: false,
    price: { days: 0, units: 0, lines: [], rentalSubtotal: 0, discountPct: 0, discount: 0, protection: 0, delivery: 0, total: 0 },
    payment: { method: 'pix', status: 'aprovado', amount: 0 },
    history: [],
    extensions: [],
    source: 'demo',
    ...extra,
  }
}

describe('freeUnits', () => {
  it('ignora malas em manutenção e filtra por cor', () => {
    const ctx = { units, orders: [] }
    expect(freeUnits(ctx, 'media-rigida', undefined, '2026-11-01', '2026-11-05').map((u) => u.id)).toEqual(['MR-01', 'MR-02'])
    expect(freeUnits(ctx, 'media-rigida', 'azul', '2026-11-01', '2026-11-05').map((u) => u.id)).toEqual(['MR-02'])
  })

  it('reserva o dia de higienização depois da devolução', () => {
    const ctx = { units, orders: [order('A', '2026-11-01', '2026-11-10', ['MR-01'])] }
    // devolve dia 10, higieniza dia 11, livre a partir do dia 12
    expect(freeUnits(ctx, 'media-rigida', 'laranja', '2026-11-11', '2026-11-14')).toHaveLength(0)
    expect(freeUnits(ctx, 'media-rigida', 'laranja', '2026-11-12', '2026-11-14')).toHaveLength(1)
    // quem devolve no dia 30/10 higieniza no 31 e libera a mala para retirada no dia 01/11
    expect(freeUnits(ctx, 'media-rigida', 'laranja', '2026-10-25', '2026-10-30')).toHaveLength(1)
    // devolvendo no dia 31, a higienização cairia no dia 01/11, que já está reservado
    expect(freeUnits(ctx, 'media-rigida', 'laranja', '2026-10-25', '2026-10-31')).toHaveLength(0)
  })

  it('libera malas de pedidos cancelados e de Pix vencido', () => {
    const now = new Date('2026-10-20T12:00:00')
    const cancelled = order('C', '2026-11-01', '2026-11-05', ['MR-02'], { status: 'cancelado' })
    const expired = order('E', '2026-11-01', '2026-11-05', ['MR-01'], {
      status: 'aguardando_pagamento',
      payment: { method: 'pix', status: 'pendente', amount: 0, expiresAt: '2026-10-20T11:00:00' },
    })
    expect(holdsUnits(cancelled, now)).toBe(false)
    expect(holdsUnits(expired, now)).toBe(false)
    expect(freeUnits({ units, orders: [cancelled, expired], now }, 'media-rigida', undefined, '2026-11-01', '2026-11-05')).toHaveLength(2)
  })
})

describe('kits', () => {
  it('só fecha o kit se todas as malas estiverem livres', () => {
    const ctx = { units, orders: [] }
    expect(availableCount(ctx, 'kit-casal', undefined, '2026-11-01', '2026-11-05')).toBe(1)
    expect(availableCount(ctx, 'kit-familia', undefined, '2026-11-01', '2026-11-05')).toBe(1)
    const busy = { units, orders: [order('B', '2026-11-03', '2026-11-04', ['MR-02'])] }
    expect(availableCount(busy, 'kit-casal', undefined, '2026-11-01', '2026-11-05')).toBe(0)
  })

  it('separa as malas certas para o kit', () => {
    const ids = allocate({ units, orders: [] }, 'kit-familia', undefined, 1, '2026-11-01', '2026-11-05')
    expect(ids?.sort()).toEqual(['BR-01', 'BR-02', 'GR-01', 'GR-02'])
  })
})

describe('allocate', () => {
  it('prefere a mala menos usada', () => {
    const past = [order('P1', '2026-09-01', '2026-09-03', ['MR-01']), order('P2', '2026-09-10', '2026-09-12', ['MR-01'])]
    expect(allocate({ units, orders: past }, 'media-rigida', undefined, 1, '2026-11-01', '2026-11-05')).toEqual(['MR-02'])
  })
  it('devolve null quando não há malas suficientes', () => {
    expect(allocate({ units, orders: [] }, 'media-rigida', undefined, 3, '2026-11-01', '2026-11-05')).toBeNull()
  })
})

describe('calendário e extensão', () => {
  it('marca o dia como livre só se a mala estiver no estoque nele', () => {
    const ctx = { units, orders: [order('A', '2026-11-01', '2026-11-03', ['MR-01', 'MR-02'])] }
    const days = dailyAvailability(ctx, 'media-rigida', undefined, ['2026-10-31', '2026-11-02', '2026-11-04', '2026-11-05'])
    expect(days).toEqual({ '2026-10-31': 2, '2026-11-02': 0, '2026-11-04': 0, '2026-11-05': 2 })
  })

  it('só estende se as mesmas malas continuarem livres', () => {
    const mine = order('M', '2026-11-01', '2026-11-05', ['MR-01'])
    const next = order('N', '2026-11-09', '2026-11-12', ['MR-01'])
    const ctx = { units, orders: [mine, next] }
    expect(canExtend(ctx, mine, 2)).toBe(true) // até dia 7, higieniza dia 8
    expect(canExtend(ctx, mine, 3)).toBe(false) // higienização cairia no dia 9
  })
})
