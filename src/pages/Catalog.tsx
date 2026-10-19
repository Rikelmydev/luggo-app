import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { MagnifyingGlass } from '../components/ui/icons'
import { MODELS, type Kind, type Size } from '../data/catalog'
import { useBag } from '../state/bag'
import { useDataVersion, usePageTitle } from '../state/hooks'
import { stockAvailable, validatePeriod } from '../services/orders'
import { rentalDays } from '../services/pricing'
import { DatesField } from '../components/DatesField'
import { ProductCard } from '../components/ProductCard'
import { EmptyState, Notice } from '../components/ui/Bits'
import styles from './Catalog.module.css'

const SIZES: { value: '' | Size | 'kit'; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'P', label: 'De bordo' },
  { value: 'M', label: 'Média' },
  { value: 'G', label: 'Grande' },
  { value: 'kit', label: 'Kits' },
]
const KINDS: { value: '' | Exclude<Kind, 'kit'>; label: string }[] = [
  { value: '', label: 'Qualquer tipo' },
  { value: 'rigida', label: 'Rígida' },
  { value: 'expansivel', label: 'Expansível' },
]

export function Catalog() {
  usePageTitle('Malas para alugar')
  const [params, setParams] = useSearchParams()
  const bag = useBag()
  const version = useDataVersion()

  const size = (params.get('tamanho') ?? '') as '' | Size | 'kit'
  const kind = (params.get('tipo') ?? '') as '' | Exclude<Kind, 'kit'>
  const sort = params.get('ordem') ?? 'tamanho'
  const onlyAvailable = params.get('livres') === '1'

  const hasDates = !!(bag.start && bag.end)
  const periodError = hasDates ? validatePeriod(bag.start, bag.end) : null
  const days = hasDates && !periodError ? rentalDays(bag.start!, bag.end!) : 0

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const list = useMemo(() => {
    const sizeOrder = { P: 0, M: 1, G: 2 }
    return MODELS.filter((m) => {
      if (size === 'kit') return m.kind === 'kit'
      if (size && (m.size !== size || m.kind === 'kit')) return false
      if (kind && m.kind !== kind) return false
      return true
    })
      .map((m) => ({ model: m, available: days ? stockAvailable(m.id, undefined, bag.start!, bag.end!) : undefined }))
      .filter((x) => !onlyAvailable || x.available === undefined || x.available > 0)
      .sort((a, b) =>
        sort === 'preco'
          ? a.model.daily - b.model.daily
          : (a.model.kind === 'kit' ? 1 : 0) - (b.model.kind === 'kit' ? 1 : 0) || sizeOrder[a.model.size] - sizeOrder[b.model.size] || a.model.daily - b.model.daily,
      )
    // version: o estoque mudou (pedido novo, mala em manutenção)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, kind, sort, onlyAvailable, days, bag.start, bag.end, version])

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className="container">
          <h1 className="display h1">Malas para alugar</h1>
          <p className={styles.sub}>Escolha as datas para ver o que está livre e o preço do período.</p>
        </div>
      </header>

      <div className={styles.bar}>
        <div className={`container ${styles.barInner}`}>
          <div className={styles.dates}>
            <DatesField start={bag.start} end={bag.end} onChange={bag.setDates} />
          </div>
          <div className={styles.filters}>
            <div className={styles.chips} role="radiogroup" aria-label="Tamanho">
              {SIZES.map((s) => (
                <button key={s.label} type="button" role="radio" aria-checked={size === s.value} className={styles.chip} onClick={() => set('tamanho', s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className={styles.selects}>
              <label className={styles.select}>
                <span className="sr-only">Tipo</span>
                <select value={kind} onChange={(e) => set('tipo', e.target.value)} disabled={size === 'kit'}>
                  {KINDS.map((k) => <option key={k.label} value={k.value}>{k.label}</option>)}
                </select>
              </label>
              <label className={styles.select}>
                <span className="sr-only">Ordenar</span>
                <select value={sort} onChange={(e) => set('ordem', e.target.value === 'tamanho' ? '' : e.target.value)}>
                  <option value="tamanho">Ordenar por tamanho</option>
                  <option value="preco">Menor preço</option>
                </select>
              </label>
              {days > 0 && (
                <label className={styles.toggle}>
                  <input type="checkbox" checked={onlyAvailable} onChange={(e) => set('livres', e.target.checked ? '1' : '')} />
                  Só livres
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`container ${styles.results}`}>
        {periodError && hasDates && <Notice tone="warn">{periodError}</Notice>}
        <p className={styles.count} aria-live="polite">
          {list.length === 1 ? '1 opção' : `${list.length} opções`}
          {days > 0 && `, preços para ${days} diárias`}
        </p>
        {list.length ? (
          <ul className={styles.grid}>
            {list.map(({ model, available }) => (
              <li key={model.id}>
                <ProductCard model={model} days={days} available={available} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MagnifyingGlass size={34} />}
            title="Nenhuma mala com esses filtros"
            action={<button className="btn btn--blue" onClick={() => setParams({}, { replace: true })}>Limpar filtros</button>}
          >
            {onlyAvailable ? 'Todas as opções desse filtro estão reservadas nas suas datas. Tente outras datas ou outro tamanho.' : 'Tente outro tamanho ou tipo.'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
