// Consulta de CEP pelo ViaCEP (serviço público e gratuito) e verificação da área de entrega.
import { BUSINESS } from '../config/business'

export interface CepAddress {
  cep: string
  street: string
  district: string
  city: string
  uf: string
}

export type CepResult =
  | { ok: true; address: CepAddress }
  | { ok: false; reason: 'invalido' | 'nao_encontrado' | 'offline' }

const digits = (cep: string) => cep.replace(/\D/g, '')

export async function lookupCep(cep: string, fetcher: typeof fetch = fetch): Promise<CepResult> {
  const d = digits(cep)
  if (d.length !== 8) return { ok: false, reason: 'invalido' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetcher(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal })
    if (!res.ok) return { ok: false, reason: res.status === 400 ? 'invalido' : 'offline' }
    const data = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return { ok: false, reason: 'nao_encontrado' }
    return {
      ok: true,
      address: {
        cep: `${d.slice(0, 5)}-${d.slice(5)}`,
        street: data.logradouro ?? '',
        district: data.bairro ?? '',
        city: data.localidade ?? '',
        uf: data.uf ?? '',
      },
    }
  } catch {
    return { ok: false, reason: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Entregamos nesse endereço? Usa cidade e UF; sem eles, usa as faixas de CEP da capital. */
export function inDeliveryArea(place: { cep: string; city?: string; uf?: string }): boolean {
  const { deliveryArea } = BUSINESS
  if (place.city && place.uf) {
    return norm(place.city) === norm(deliveryArea.city) && place.uf.toUpperCase() === deliveryArea.uf
  }
  const d = digits(place.cep)
  return d.length === 8 && deliveryArea.cepRanges.some(([from, to]) => d >= from && d <= to)
}
