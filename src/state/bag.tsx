// A "reserva em montagem": datas da viagem, malas escolhidas e proteção. Fica salva no navegador.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Color } from '../data/catalog'
import { todayISO, type ISODate } from '../lib/dates'
import { kv } from '../services/storage'

export interface BagItem {
  key: string
  modelId: string
  color?: Color
  qty: number
}

interface BagState {
  start?: ISODate
  end?: ISODate
  items: BagItem[]
  protection: boolean
}

interface BagApi extends BagState {
  count: number
  setDates: (start?: ISODate, end?: ISODate) => void
  add: (item: Omit<BagItem, 'key'>) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  setProtection: (on: boolean) => void
  clear: () => void
}

const KEY = 'luggo:bag:v1'
const BagContext = createContext<BagApi | null>(null)

function load(): BagState {
  try {
    const raw = kv.get(KEY)
    if (raw) {
      const s = JSON.parse(raw) as BagState
      // Datas que já passaram deixam de valer.
      if (s.start && s.start < todayISO()) return { ...s, start: undefined, end: undefined }
      return { ...s, items: s.items ?? [], protection: !!s.protection }
    }
  } catch {
    /* começa vazio */
  }
  return { items: [], protection: false }
}

const keyOf = (modelId: string, color?: Color) => `${modelId}:${color ?? 'sortida'}`

export function BagProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BagState>(load)

  useEffect(() => {
    kv.set(KEY, JSON.stringify(state))
  }, [state])

  const setDates = useCallback((start?: ISODate, end?: ISODate) => setState((s) => ({ ...s, start, end })), [])
  const add = useCallback(
    (item: Omit<BagItem, 'key'>) =>
      setState((s) => {
        const key = keyOf(item.modelId, item.color)
        const existing = s.items.find((i) => i.key === key)
        const items = existing
          ? s.items.map((i) => (i.key === key ? { ...i, qty: i.qty + item.qty } : i))
          : [...s.items, { ...item, key }]
        return { ...s, items }
      }),
    [],
  )
  const setQty = useCallback(
    (key: string, qty: number) => setState((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)) })),
    [],
  )
  const remove = useCallback((key: string) => setState((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) })), [])
  const setProtection = useCallback((protection: boolean) => setState((s) => ({ ...s, protection })), [])
  const clear = useCallback(() => setState((s) => ({ ...s, items: [], protection: false })), [])

  const value = useMemo<BagApi>(
    () => ({ ...state, count: state.items.reduce((n, i) => n + i.qty, 0), setDates, add, setQty, remove, setProtection, clear }),
    [state, setDates, add, setQty, remove, setProtection, clear],
  )
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>
}

export function useBag(): BagApi {
  const ctx = useContext(BagContext)
  if (!ctx) throw new Error('useBag fora do BagProvider')
  return ctx
}
