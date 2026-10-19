// Dados fictícios de demonstração: o estoque inicial de 30 malas do plano de negócio
// e um histórico de pedidos inventados, gerado sempre igual a partir da data de hoje.
import { BUSINESS } from '../config/business'
import { MODELS, getModel, COLOR_INFO, type Color } from './catalog'
import { addDays, todayISO, type ISODate } from '../lib/dates'
import { allocate } from '../services/availability'
import { quote } from '../services/pricing'
import type { Address, Fulfillment, Order, OrderStatus, StatusEvent, Unit } from '../domain/types'

const STOCK: { modelId: string; prefix: string; colors: Color[] }[] = [
  { modelId: 'bordo-rigida', prefix: 'BR', colors: ['laranja', 'azul', 'grafite', 'laranja', 'azul', 'grafite'] },
  { modelId: 'bordo-expansivel', prefix: 'BE', colors: ['grafite', 'azul', 'grafite'] },
  { modelId: 'media-rigida', prefix: 'MR', colors: ['laranja', 'azul', 'grafite', 'laranja', 'azul', 'grafite', 'laranja', 'azul'] },
  { modelId: 'media-expansivel', prefix: 'ME', colors: ['azul', 'grafite', 'azul', 'grafite'] },
  { modelId: 'grande-rigida', prefix: 'GR', colors: ['laranja', 'azul', 'grafite', 'laranja', 'azul', 'grafite'] },
  { modelId: 'grande-expansivel', prefix: 'GE', colors: ['grafite', 'azul', 'grafite'] },
]

const NAMES = [
  'Ana Beatriz Moreira', 'Lucas Ferreira', 'Juliana Sato', 'Rafael Nunes', 'Camila Oliveira', 'Thiago Barros',
  'Mariana Lopes', 'Gustavo Almeida', 'Letícia Kimura', 'Pedro Henrique Rocha', 'Isabela Duarte', 'Felipe Andrade',
  'Larissa Monteiro', 'Bruno Takahashi', 'Fernanda Ribeiro', 'Diego Carvalho', 'Aline Souza', 'Vinícius Matos',
  'Natália Prado', 'Rodrigo Teixeira', 'Carolina Mendes', 'Eduardo Pires', 'Beatriz Yamamoto', 'Gabriel Farias',
  'Renata Campos', 'Marcelo Vieira', 'Paula Antunes', 'João Victor Lima', 'Priscila Gomes', 'Henrique Costa',
]

const PLACES: Omit<Address, 'number' | 'complement'>[] = [
  { cep: '05415-030', street: 'Rua Cardeal Arcoverde', district: 'Pinheiros', city: 'São Paulo', uf: 'SP' },
  { cep: '04101-000', street: 'Rua Vergueiro', district: 'Vila Mariana', city: 'São Paulo', uf: 'SP' },
  { cep: '01310-100', street: 'Avenida Paulista', district: 'Bela Vista', city: 'São Paulo', uf: 'SP' },
  { cep: '03178-200', street: 'Rua da Mooca', district: 'Mooca', city: 'São Paulo', uf: 'SP' },
  { cep: '02012-010', street: 'Rua Voluntários da Pátria', district: 'Santana', city: 'São Paulo', uf: 'SP' },
  { cep: '05003-000', street: 'Rua Turiassu', district: 'Perdizes', city: 'São Paulo', uf: 'SP' },
  { cep: '04538-132', street: 'Rua Joaquim Floriano', district: 'Itaim Bibi', city: 'São Paulo', uf: 'SP' },
  { cep: '01227-000', street: 'Rua Doutor Veiga Filho', district: 'Higienópolis', city: 'São Paulo', uf: 'SP' },
]

// Gerador pseudoaleatório com semente: os mesmos dados toda vez.
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeCode(rand: () => number = Math.random): string {
  let s = 'LG'
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
  return s
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function at(day: ISODate, hour: number, minute = 0): string {
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

export function buildSeed(now: Date): { units: Unit[]; orders: Order[] } {
  const today = todayISO(now)
  const rand = rng(2026)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))

  const units: Unit[] = STOCK.flatMap((s) =>
    s.colors.map((color, i) => ({
      id: `${s.prefix}-${String(i + 1).padStart(2, '0')}`,
      modelId: s.modelId,
      color,
      acquiredAt: addDays(today, -150),
      maintenance: false,
    })),
  )
  const broken = units.find((u) => u.id === 'ME-04')
  if (broken) {
    broken.maintenance = true
    broken.note = 'Roda traseira trocada, volta ao estoque após teste'
  }

  // Modelos mais alugados aparecem mais vezes (média rígida lidera, como no plano).
  const weighted = [
    'media-rigida', 'media-rigida', 'media-rigida', 'media-rigida',
    'bordo-rigida', 'bordo-rigida', 'bordo-rigida',
    'grande-rigida', 'grande-rigida', 'grande-rigida',
    'media-expansivel', 'bordo-expansivel', 'grande-expansivel', 'grande-expansivel',
    'kit-casal', 'kit-familia',
  ]

  type Draft = { start: ISODate; end: ISODate; modelId: string; forced?: OrderStatus }
  const drafts: Draft[] = []
  for (let i = 0; i < 110; i++) {
    const start = addDays(today, between(-140, 45))
    const len = pick([3, 4, 5, 5, 6, 7, 7, 7, 8, 10, 10, 12, 14, 15, 21])
    drafts.push({ start, end: addDays(start, len), modelId: pick(weighted) })
  }
  // Movimento garantido no painel "Hoje".
  drafts.push({ start: today, end: addDays(today, 6), modelId: 'media-rigida' })
  drafts.push({ start: today, end: addDays(today, 4), modelId: 'bordo-rigida' })
  drafts.push({ start: addDays(today, -7), end: today, modelId: 'grande-rigida' })
  drafts.push({ start: addDays(today, -5), end: today, modelId: 'media-rigida' })
  drafts.push({ start: addDays(today, -9), end: addDays(today, -1), modelId: 'bordo-expansivel' })
  drafts.sort((a, b) => (a.start < b.start ? -1 : 1))

  const orders: Order[] = []
  const codes = new Set<string>()
  for (const draft of drafts) {
    const model = getModel(draft.modelId)!
    const color = model.colors.length ? pick(model.colors) : undefined
    const unitIds = allocate({ units, orders, now }, model.id, color, 1, draft.start, draft.end)
    if (!unitIds) continue

    let code = makeCode(rand)
    while (codes.has(code)) code = makeCode(rand)
    codes.add(code)

    const name = pick(NAMES)
    const [first, ...rest] = name.split(' ')
    const delivery = rand() < 0.58
    const place = pick(PLACES)
    const fulfillment: Fulfillment = delivery
      ? {
          type: 'entrega',
          address: { ...place, number: String(between(12, 2400)), complement: rand() < 0.5 ? `Apto ${between(11, 184)}` : undefined },
          window: pick(BUSINESS.operations.deliveryWindows).id,
        }
      : { type: 'loja' }
    const protection = rand() < 0.45
    const price = quote({
      items: [{ modelId: model.id, qty: 1, colorLabel: color ? COLOR_INFO[color].label : undefined }],
      start: draft.start,
      end: draft.end,
      protection,
      delivery,
    })

    const createdDay = addDays(draft.start, -between(2, 18))
    const createdAt = at(createdDay, between(8, 22), between(0, 59))
    const paidAt = at(createdDay, Math.min(23, Number(createdAt.slice(11, 13)) + 1), between(0, 59))
    const cleanEnd = addDays(draft.end, BUSINESS.operations.cleaningDays)

    let status: OrderStatus
    if (draft.start > today) status = 'confirmado'
    else if (draft.start === today) status = 'confirmado'
    else if (draft.end >= today) status = 'com_cliente'
    else if (cleanEnd >= today) status = 'devolvido'
    else status = 'concluido'
    if (status === 'concluido' && rand() < 0.06) status = 'cancelado'

    const history: StatusEvent[] = [
      { status: 'aguardando_pagamento', at: createdAt },
      { status: 'confirmado', at: paidAt },
    ]
    if (status === 'cancelado') history.push({ status: 'cancelado', at: at(addDays(draft.start, -2), 10, 12), note: 'Cancelado pelo cliente' })
    if (['com_cliente', 'devolvido', 'concluido'].includes(status)) history.push({ status: 'com_cliente', at: at(draft.start, between(9, 18), between(0, 59)) })
    if (['devolvido', 'concluido'].includes(status)) history.push({ status: 'devolvido', at: at(draft.end, between(9, 19), between(0, 59)) })
    if (status === 'concluido') history.push({ status: 'concluido', at: at(cleanEnd, between(9, 17), between(0, 59)) })

    orders.push({
      code,
      createdAt,
      status,
      customer: {
        name,
        email: `${slug(first)}.${slug(rest[rest.length - 1] ?? 'cliente')}@example.com`,
        phone: `119${String(between(10000000, 99999999))}`,
      },
      start: draft.start,
      end: draft.end,
      items: [{ modelId: model.id, color, qty: 1, unitIds }],
      fulfillment,
      protection,
      price,
      payment: { method: rand() < 0.64 ? 'pix' : 'cartao', status: 'aprovado', amount: price.total, paidAt },
      history,
      extensions: [],
      source: 'demo',
    })
  }

  return { units, orders: orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }
}

export const DEMO_MODEL_COUNT = MODELS.length
