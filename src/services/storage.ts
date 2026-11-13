// Dados que as telas leem na hora. Sem Supabase, é o banco inteiro guardado no navegador;
// com Supabase, é uma cópia do que esta pessoa pode ver, mantida em dia por services/remote.ts.
import type { ContactMessage, Order, Unit } from '../domain/types'
import { buildSeed } from '../data/seed'
import { REMOTE } from './supabase'

export interface DB {
  version: 1
  seededAt: string
  units: Unit[]
  /** Pedidos completos que esta pessoa pode ver: os dela, ou todos para a equipe. */
  orders: Order[]
  messages: ContactMessage[]
  /** Ocupação das outras reservas, sem dados pessoais (só com Supabase). */
  holds?: Order[]
}

const DB_KEY = 'luggo:db:v1'
/** Últimos dados digitados no pagamento: preenchem a próxima compra e o login. */
export const CUSTOMER_KEY = 'luggo:cliente:v1'
const memory = new Map<string, string>()

export const kv = {
  get(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  },
  set(key: string, value: string) {
    memory.set(key, value)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
    } catch {
      /* navegação privada ou cota cheia: segue só em memória */
    }
  },
  remove(key: string) {
    memory.delete(key)
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
    } catch {
      /* ignora */
    }
  },
}

let cache: DB | null = null
const listeners = new Set<() => void>()

function seedDB(): DB {
  const { units, orders } = buildSeed(new Date())
  return { version: 1, seededAt: new Date().toISOString(), units, orders, messages: [] }
}

export function readDB(): DB {
  if (cache) return cache
  if (REMOTE) {
    cache = { version: 1, seededAt: new Date().toISOString(), units: [], orders: [], messages: [], holds: [] }
    return cache
  }
  const raw = kv.get(DB_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === 1 && Array.isArray(parsed.orders)) {
        cache = parsed
        return parsed
      }
    } catch {
      /* dado corrompido: recria abaixo */
    }
  }
  cache = seedDB()
  kv.set(DB_KEY, JSON.stringify(cache))
  return cache
}

export function writeDB(next: DB) {
  cache = next
  if (!REMOTE) kv.set(DB_KEY, JSON.stringify(next))
  listeners.forEach((fn) => fn())
}

export function updateDB(fn: (db: DB) => DB): DB {
  const next = fn(readDB())
  writeDB(next)
  return next
}

/** Volta os dados de demonstração ao estado inicial (pedidos feitos no site são mantidos). */
export function resetDemoData(keepSiteOrders = true): DB {
  const fresh = seedDB()
  const mine = keepSiteOrders ? readDB().orders.filter((o) => o.source === 'site') : []
  const next = { ...fresh, orders: [...fresh.orders, ...mine], messages: readDB().messages }
  writeDB(next)
  return next
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Outra aba mudou os dados: recarrega.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && !REMOTE) {
      cache = null
      listeners.forEach((fn) => fn())
    }
  })
}

/** Latência simulada sem Supabase, para a interface mostrar estados de carregamento reais. */
export const network = { latency: REMOTE ? 0 : 350 }
export const delay = (ms?: number) =>
  network.latency === 0 ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms ?? network.latency))
