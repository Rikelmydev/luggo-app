import type { Color } from '../data/catalog'
import type { DeliveryWindowId } from '../config/business'
import type { ISODate } from '../lib/dates'

export type OrderStatus =
  | 'aguardando_pagamento'
  | 'confirmado'
  | 'com_cliente'
  | 'devolvido'
  | 'concluido'
  | 'cancelado'

export type PaymentMethod = 'pix' | 'cartao'
export type PaymentStatus = 'pendente' | 'aprovado' | 'recusado' | 'expirado'

/** Uma mala física do estoque. */
export interface Unit {
  id: string
  modelId: string
  color: Color
  acquiredAt: ISODate
  maintenance: boolean
  note?: string
}

export interface Customer {
  name: string
  email: string
  phone: string
}

export interface Address {
  cep: string
  street: string
  number: string
  complement?: string
  district: string
  city: string
  uf: string
}

export type Fulfillment =
  | { type: 'loja' }
  | { type: 'entrega'; address: Address; window: DeliveryWindowId }

export interface OrderItem {
  modelId: string
  color?: Color
  qty: number
  /** Malas físicas separadas para este item. */
  unitIds: string[]
}

export interface PriceLine {
  modelId: string
  label: string
  qty: number
  days: number
  daily: number
  subtotal: number
}

export interface PriceBreakdown {
  days: number
  units: number
  lines: PriceLine[]
  rentalSubtotal: number
  discountPct: number
  discount: number
  protection: number
  delivery: number
  total: number
}

export interface Payment {
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  pixCode?: string
  expiresAt?: string
  paidAt?: string
}

export interface StatusEvent {
  status: OrderStatus
  at: string
  note?: string
}

export interface Extension {
  days: number
  amount: number
  previousEnd: ISODate
  createdAt: string
  payment: Payment
}

export interface Order {
  code: string
  createdAt: string
  status: OrderStatus
  customer: Customer
  start: ISODate
  end: ISODate
  items: OrderItem[]
  fulfillment: Fulfillment
  protection: boolean
  price: PriceBreakdown
  payment: Payment
  history: StatusEvent[]
  extensions: Extension[]
  /** 'site' = feita neste navegador; 'demo' = pedido fictício de demonstração. */
  source: 'site' | 'demo'
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  topic: string
  message: string
  createdAt: string
}

export const STATUS_INFO: Record<OrderStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warn' },
  confirmado: { label: 'Confirmada', tone: 'info' },
  com_cliente: { label: 'Com o cliente', tone: 'ok' },
  devolvido: { label: 'Em higienização', tone: 'muted' },
  concluido: { label: 'Concluída', tone: 'muted' },
  cancelado: { label: 'Cancelada', tone: 'bad' },
}
