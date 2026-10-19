import { useEffect, useState, useSyncExternalStore, type DependencyList } from 'react'
import { readDB, subscribe } from '../services/storage'

/** Versão dos dados: muda sempre que um pedido ou mala muda (inclusive em outra aba). */
let version = 0
subscribe(() => {
  version++
})
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

/** Lê o banco local de forma reativa (para o painel da equipe e o estoque). */
export function useDB() {
  useDataVersion()
  return readDB()
}

type AsyncState<T> = { status: 'loading'; data?: T } | { status: 'ready'; data: T } | { status: 'error'; error: string; data?: T }

/** Carrega dados assíncronos com estado de carregamento, como numa API real. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const dataVersion = useDataVersion()
  useEffect(() => {
    let alive = true
    setState((s) => ({ status: 'loading', data: s.data }))
    fn()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: unknown) => alive && setState({ status: 'error', error: e instanceof Error ? e.message : 'Algo deu errado.' }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, dataVersion])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Luggo` : 'Luggo | Aluguel de malas em São Paulo'
  }, [title])
}

/** Relógio que atualiza a cada segundo (contagem do Pix). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
