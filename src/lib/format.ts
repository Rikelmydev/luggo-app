const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const money = (value: number) => brl.format(value)
/** R$ 14 (sem centavos quando o valor é inteiro) */
export const moneyShort = (value: number) => (Number.isInteger(value) ? brlShort.format(value) : brl.format(value))

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Arredonda para centavos sem erro de ponto flutuante. */
export const cents = (value: number) => Math.round(value * 100) / 100

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

/** (11) 98765-4321 */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** 01234-567 */
export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Esconde o meio do telefone na área da equipe: (11) 9****-4821 */
export function hidePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return phone
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const isPhone = (v: string) => v.replace(/\D/g, '').length >= 10
