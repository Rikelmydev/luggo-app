// Contagem até a devolução e o e-mail de lembrete. Sem backend, o envio é simulado:
// o lembrete fica registrado no pedido, neste navegador.
import { BUSINESS } from '../config/business'
import { diffDays, formatLong, fromISO, todayISO } from '../lib/dates'
import { firstName, plural } from '../lib/format'
import type { Order } from '../domain/types'

const { storeCloseHour, deliveryWindows, returnReminderHours } = BUSINESS.operations
const HOUR = 3_600_000

/** Até quando dá para devolver: fim do horário da loja ou da janela de coleta, no último dia. */
export function returnDeadline(order: Order): Date {
  const day = fromISO(order.end)
  const { fulfillment } = order
  const hour =
    fulfillment.type === 'entrega'
      ? deliveryWindows.find((w) => w.id === fulfillment.window)!.endHour
      : day.getDay() === 6
        ? storeCloseHour.saturday
        : storeCloseHour.weekday
  day.setHours(hour)
  return day
}

/** Quando o lembrete deve sair. */
export const reminderTime = (order: Order) => new Date(returnDeadline(order).getTime() - returnReminderHours * HOUR)

/** Só a reserva paga e ainda fora de casa, ou com o cliente, tem devolução pela frente. */
const awaitsReturn = (order: Order) => order.status === 'confirmado' || order.status === 'com_cliente'

export function reminderDue(order: Order, now: Date = new Date()): boolean {
  return order.source === 'site' && awaitsReturn(order) && !order.returnReminder && now >= reminderTime(order) && now < returnDeadline(order)
}

export interface Countdown {
  /** "Faltam 5 dias", "Faltam 18 horas", "Passou do prazo". */
  label: string
  late: boolean
  /** Falta menos do que o prazo do lembrete. */
  urgent: boolean
}

export function returnCountdown(order: Order, now: Date = new Date()): Countdown | null {
  if (!awaitsReturn(order)) return null
  const ms = returnDeadline(order).getTime() - now.getTime()
  if (ms <= 0) return { label: 'Passou do prazo', late: true, urgent: true }
  const urgent = ms <= returnReminderHours * HOUR
  if (urgent) {
    const hours = Math.ceil(ms / HOUR)
    return { label: `${hours === 1 ? 'Falta' : 'Faltam'} ${plural(hours, 'hora', 'horas')}`, late: false, urgent }
  }
  const days = diffDays(todayISO(now), order.end)
  return { label: `${days === 1 ? 'Falta' : 'Faltam'} ${plural(days, 'dia', 'dias')}`, late: false, urgent }
}

export function returnEmail(order: Order): { to: string; subject: string; paragraphs: string[] } {
  const hour = returnDeadline(order).getHours()
  const delivery = order.fulfillment.type === 'entrega'
  return {
    to: order.customer.email,
    subject: `Faltam ${returnReminderHours}h para devolver sua mala (reserva ${order.code})`,
    paragraphs: [
      `Olá, ${firstName(order.customer.name)}!`,
      `Sua reserva ${order.code} termina em ${formatLong(order.end)}, até as ${hour}h.`,
      delivery
        ? 'Vamos buscar as malas no mesmo endereço da entrega, na janela de horário que você escolheu. Deixe tudo vazio e fechado, e alguém precisa estar lá para entregar.'
        : `Deixe as malas vazias na ${BUSINESS.store.name}: ${BUSINESS.store.address}.`,
      'Quer ficar mais dias? Peça pela página da reserva antes do fim do aluguel: os dias extras saem pela diária cheia.',
      'Boa volta!',
    ],
  }
}
