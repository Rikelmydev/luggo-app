import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayISO } from '../lib/dates'
import { busyRange } from './availability'
import { inDeliveryArea, lookupCep } from './cep'
import {
  cancelOrder,
  canCancel,
  checkExtension,
  createOrder,
  extendOrder,
  settlePayment,
  stockAvailable,
  validatePeriod,
  type NewOrder,
} from './orders'
import { network, readDB, resetDemoData } from './storage'
import { buildSeed } from '../data/seed'

network.latency = 0

const base = (over: Partial<NewOrder> = {}): NewOrder => ({
  customer: { name: 'Marina Okada', email: 'Marina@Example.com', phone: '(11) 98765-4321' },
  start: addDays(todayISO(), 60),
  end: addDays(todayISO(), 67),
  items: [{ modelId: 'media-rigida', color: 'azul', qty: 1 }],
  fulfillment: { type: 'loja' },
  protection: false,
  method: 'pix',
  ...over,
})

beforeEach(() => {
  resetDemoData(false)
})

describe('dados de demonstração', () => {
  it('tem as 30 malas do estoque inicial', () => {
    expect(readDB().units).toHaveLength(30)
  })

  it('nunca reserva a mesma mala em períodos que se cruzam', () => {
    const { orders } = buildSeed(new Date())
    const active = orders.filter((o) => o.status !== 'cancelado')
    for (const a of active) {
      for (const b of active) {
        if (a.code >= b.code) continue
        const [as, ae] = busyRange(a.start, a.end)
        const [bs, be] = busyRange(b.start, b.end)
        if (as > be || bs > ae) continue
        const shared = a.items.flatMap((i) => i.unitIds).filter((id) => b.items.some((i) => i.unitIds.includes(id)))
        expect(shared, `${a.code} x ${b.code}`).toEqual([])
      }
    }
    expect(active.length).toBeGreaterThan(40)
  })
})

describe('período', () => {
  it('exige o mínimo de diárias e datas futuras', () => {
    expect(validatePeriod(addDays(todayISO(), 5), addDays(todayISO(), 6))).toMatch(/mínimo/)
    expect(validatePeriod(addDays(todayISO(), -1), addDays(todayISO(), 5))).toMatch(/passado/)
    expect(validatePeriod(addDays(todayISO(), 5), addDays(todayISO(), 9))).toBeNull()
  })
})

describe('pedido do começo ao fim', () => {
  it('cria, segura a mala e confirma o pagamento', async () => {
    const before = stockAvailable('media-rigida', 'azul', base().start, base().end)
    const res = await createOrder(base())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.status).toBe('aguardando_pagamento')
    expect(res.value.customer.email).toBe('marina@example.com')
    expect(res.value.payment.pixCode).toContain('LUGGO-DEMO')
    expect(stockAvailable('media-rigida', 'azul', base().start, base().end)).toBe(before - 1)

    const paid = await settlePayment(res.value.code, true)
    expect(paid.ok && paid.value.status).toBe('confirmado')
  })

  it('recusa o cartão sem perder a reserva', async () => {
    const res = await createOrder(base({ method: 'cartao' }))
    if (!res.ok) throw new Error(res.error)
    const declined = await settlePayment(res.value.code, false)
    expect(declined.ok).toBe(false)
    expect(readDB().orders.find((o) => o.code === res.value.code)?.status).toBe('aguardando_pagamento')
  })

  it('não deixa reservar mais malas do que existem', async () => {
    const res = await createOrder(base({ items: [{ modelId: 'grande-expansivel', qty: 9 }] }))
    expect(res.ok).toBe(false)
  })

  it('cobra entrega e exige retirada a partir de amanhã', async () => {
    const address = { cep: '04101-000', street: 'Rua Vergueiro', number: '100', district: 'Vila Mariana', city: 'São Paulo', uf: 'SP' }
    const today = await createOrder(base({ start: todayISO(), end: addDays(todayISO(), 4), fulfillment: { type: 'entrega', address, window: 'tarde' } }))
    expect(today.ok).toBe(false)
    const ok = await createOrder(base({ fulfillment: { type: 'entrega', address, window: 'tarde' } }))
    expect(ok.ok && ok.value.price.delivery).toBe(24.9)
  })

  it('cancela grátis com antecedência e estende quando as malas estão livres', async () => {
    const res = await createOrder(base())
    if (!res.ok) throw new Error(res.error)
    await settlePayment(res.value.code, true)
    const order = readDB().orders.find((o) => o.code === res.value.code)!
    expect(canCancel(order)).toEqual({ ok: true, refund: true })
    expect(checkExtension(order, 2)).toBeNull()
    const ext = await extendOrder(order.code, 2)
    expect(ext.ok && ext.value.end).toBe(addDays(base().end, 2))
    const cancelled = await cancelOrder(order.code)
    expect(cancelled.ok && cancelled.value.status).toBe('cancelado')
  })
})

describe('CEP', () => {
  it('entrega só na capital', () => {
    expect(inDeliveryArea({ cep: '04101-000', city: 'São Paulo', uf: 'SP' })).toBe(true)
    expect(inDeliveryArea({ cep: '09010-000', city: 'Santo André', uf: 'SP' })).toBe(false)
    expect(inDeliveryArea({ cep: '05415-030' })).toBe(true)
    expect(inDeliveryArea({ cep: '06010-000' })).toBe(false)
  })

  it('trata CEP inválido, inexistente e falta de internet', async () => {
    expect(await lookupCep('123')).toEqual({ ok: false, reason: 'invalido' })
    const notFound = (async () => new Response(JSON.stringify({ erro: 'true' }))) as typeof fetch
    expect(await lookupCep('99999-999', notFound)).toEqual({ ok: false, reason: 'nao_encontrado' })
    const offline = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
    expect(await lookupCep('04101-000', offline)).toEqual({ ok: false, reason: 'offline' })
    const found = (async () =>
      new Response(JSON.stringify({ logradouro: 'Rua Vergueiro', bairro: 'Vila Mariana', localidade: 'São Paulo', uf: 'SP' }))) as typeof fetch
    const r = await lookupCep('04101000', found)
    expect(r.ok && r.address).toEqual({ cep: '04101-000', street: 'Rua Vergueiro', district: 'Vila Mariana', city: 'São Paulo', uf: 'SP' })
  })
})
