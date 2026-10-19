// Datas sempre como 'AAAA-MM-DD' no fuso local: o aluguel é contado em dias, não em horas.
export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now)
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** Diferença em dias de calendário (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Dois intervalos [aStart, aEnd] e [bStart, bEnd] (inclusivos) se cruzam? */
export function overlaps(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const fmtShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const fmtWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
const fmtLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const fmtFull = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const clean = (s: string) => s.replace(/\./g, '').replace(' de ', ' ')

/** "24 out" */
export const formatShort = (iso: ISODate) => clean(fmtShort.format(fromISO(iso)))
/** "sáb, 24 out" */
export const formatWeekday = (iso: ISODate) => clean(fmtWeekday.format(fromISO(iso)))
/** "sábado, 24 de outubro" */
export const formatLong = (iso: ISODate) => fmtLong.format(fromISO(iso))
/** "outubro de 2026" */
export const formatMonth = (d: Date) => {
  const s = fmtMonth.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/** "24/10/2026" */
export const formatFull = (iso: ISODate) => fmtFull.format(fromISO(iso))

export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  return `${fmtFull.format(d)} às ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

/** Semanas do mês (domingo primeiro), com null nas casas fora do mês. */
export function monthGrid(year: number, month: number): (ISODate | null)[][] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (ISODate | null)[] = Array(first.getDay()).fill(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(toISO(new Date(year, month, day)))
  while (cells.length % 7) cells.push(null)
  const weeks: (ISODate | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
