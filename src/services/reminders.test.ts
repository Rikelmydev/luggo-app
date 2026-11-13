import { beforeEach, describe, expect, it } from 'vitest'
import type { Order } from '../domain/types'
import { addDays, todayISO } from '../lib/dates'
import { createOrder, extendOrder, isActive, reservedCount, sendDueReminders, settlePayment, type NewOrder } from './orders'
import { reminderDue, reminderTime, returnCountdown, returnDeadline, returnEmail } from './reminders'
import { network, readDB, resetDemoData } from './storage'

network.latency = 0

const input = (over: Partial<NewOrder> = {}): NewOrder => ({
  customer: { name: 'Marina Okada', email: 'marina@example.com', phone: '(11) 98765-4321' },
  start: addDays(todayISO(), 60),
  end: addDays(todayISO(), 67),
  items: [{ modelId: 'media-rigida', color: 'azul', qty: 2 }],
  fulfillment: { type: 'loja' },
  protection: false,
  method: 'pix',
  ...over,
})

async function paidOrder(over: Partial<NewOrder> = {}): Promise<Order> {
  const made = await createOrder(input(over))
  if (!made.ok) throw new Error(made.error)
  const paid = await settlePayment(made.value.code, true)
  if (!paid.ok) throw new Error(paid.error)
  return paid.value
}

const at = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000)

beforeEach(() => {
  resetDemoData(false)
})

describe('contagem de reservas', () => {
  it('reserva confirmada entra na contagem de malas', async () => {
    expect(reservedCount(readDB().orders)).toBe(0)
    await paidOrder()
    expect(reservedCount(readDB().orders)).toBe(2)
  })

  it('reserva sem pagamento ainda não conta', async () => {
    await createOrder(input())
    expect(reservedCount(readDB().orders)).toBe(0)
  })

  it('pix vencido deixa de valer, mala com o cliente continua valendo mesmo atrasada', () => {
    const base = readDB().orders[0]
    const now = new Date()
    const expired = { ...base, status: 'aguardando_pagamento', end: addDays(todayISO(), 5), payment: { ...base.payment, expiresAt: at(now, -1).toISOString() } } as Order
    expect(isActive(expired, now)).toBe(false)
    const late = { ...base, status: 'com_cliente', end: addDays(todayISO(), -2) } as Order
    expect(isActive(late, now)).toBe(true)
  })
})

describe('prazo de devolução', () => {
  // 2026-11-13 é sexta e 2026-11-14 é sábado.
  const order = (end: string, over: Partial<Order> = {}) => ({ ...readDB().orders[0], status: 'confirmado', source: 'site', end, fulfillment: { type: 'loja' }, returnReminder: undefined, ...over }) as Order

  it('vai até o fim do horário da loja, mais cedo no sábado', () => {
    expect(returnDeadline(order('2026-11-13')).getHours()).toBe(20)
    expect(returnDeadline(order('2026-11-14')).getHours()).toBe(15)
  })

  it('com coleta, vai até o fim da janela escolhida', () => {
    const fulfillment = { type: 'entrega', window: 'tarde', address: { cep: '', street: '', number: '', district: '', city: '', uf: '' } } as Order['fulfillment']
    expect(returnDeadline(order('2026-11-13', { fulfillment })).getHours()).toBe(16)
  })

  it('conta em dias e, nas últimas 24h, em horas', () => {
    const o = order('2026-11-13')
    const deadline = returnDeadline(o)
    expect(returnCountdown(o, new Date(2026, 10, 8, 10))).toMatchObject({ label: 'Faltam 5 dias', urgent: false })
    expect(returnCountdown(o, new Date(2026, 10, 12, 10))).toMatchObject({ label: 'Falta 1 dia', urgent: false })
    expect(returnCountdown(o, at(deadline, -18))).toMatchObject({ label: 'Faltam 18 horas', urgent: true })
    expect(returnCountdown(o, at(deadline, -0.5))).toMatchObject({ label: 'Falta 1 hora', urgent: true })
    expect(returnCountdown(o, at(deadline, 1))).toMatchObject({ label: 'Passou do prazo', late: true })
  })

  it('não conta para reserva cancelada ou já devolvida', () => {
    expect(returnCountdown(order('2026-11-13', { status: 'cancelado' }))).toBeNull()
    expect(returnCountdown(order('2026-11-13', { status: 'devolvido' }))).toBeNull()
  })
})

describe('lembrete de devolução', () => {
  it('sai 24h antes do prazo, uma vez só, para o e-mail da reserva', async () => {
    const o = await paidOrder()
    const when = reminderTime(o)
    expect(await sendDueReminders(at(when, -1))).toHaveLength(0)
    const sent = await sendDueReminders(at(when, 1))
    expect(sent.map((s) => s.code)).toEqual([o.code])
    expect(sent[0].returnReminder?.to).toBe('marina@example.com')
    expect(await sendDueReminders(at(when, 2))).toHaveLength(0)
  })

  it('não sai depois do prazo, nem para pedidos de demonstração', async () => {
    const o = await paidOrder()
    expect(reminderDue(o, at(returnDeadline(o), 1))).toBe(false)
    expect(reminderDue({ ...o, source: 'demo' }, at(reminderTime(o), 1))).toBe(false)
  })

  it('estender o aluguel arma o lembrete de novo', async () => {
    const o = await paidOrder()
    await sendDueReminders(at(reminderTime(o), 1))
    const extended = await extendOrder(o.code, 2)
    expect(extended.ok && extended.value.returnReminder).toBeUndefined()
  })

  it('o e-mail diz o código, o prazo e para quem vai', async () => {
    const o = await paidOrder()
    const mail = returnEmail(o)
    expect(mail.to).toBe('marina@example.com')
    expect(mail.subject).toContain('24h')
    expect(mail.subject).toContain(o.code)
    expect(mail.paragraphs.join(' ')).toContain(`até as ${returnDeadline(o).getHours()}h`)
  })
})
