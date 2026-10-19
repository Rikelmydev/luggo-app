import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CaretLeft, CaretRight } from './ui/icons'
import {
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  addDays,
  diffDays,
  formatLong,
  formatMonth,
  formatWeekday,
  fromISO,
  monthGrid,
  todayISO,
  type ISODate,
} from '../lib/dates'
import { plural } from '../lib/format'
import styles from './DateRangePicker.module.css'

export interface DateRangePickerProps {
  start?: ISODate
  end?: ISODate
  onChange: (start?: ISODate, end?: ISODate) => void
  minDate: ISODate
  maxDate: ISODate
  minDays: number
  maxDays: number
  months?: 1 | 2
  /** Malas livres para retirada em cada dia. */
  stockFor?: (days: ISODate[]) => Record<ISODate, number>
  /** O período inteiro tem mala livre (incluindo a higienização)? */
  rangeOk?: (start: ISODate, end: ISODate) => boolean
  needed?: number
}

const monthStart = (iso: ISODate) => {
  const d = fromISO(iso)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
const shiftMonth = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

export function DateRangePicker({
  start,
  end,
  onChange,
  minDate,
  maxDate,
  minDays,
  maxDays,
  months = 2,
  stockFor,
  rangeOk,
  needed = 1,
}: DateRangePickerProps) {
  const [view, setView] = useState(() => monthStart(start ?? minDate))
  const [hover, setHover] = useState<ISODate | null>(null)
  const [focusDay, setFocusDay] = useState<ISODate>(start ?? minDate)
  const [hint, setHint] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const keyboardNav = useRef(false)
  const today = todayISO()
  const phase: 'start' | 'end' = start && !end ? 'end' : 'start'

  const shown = useMemo(() => Array.from({ length: months }, (_, i) => shiftMonth(view, i)), [view, months])
  const grids = useMemo(() => shown.map((m) => monthGrid(m.getFullYear(), m.getMonth())), [shown])
  const visibleDays = useMemo(() => grids.flat(2).filter((d): d is ISODate => !!d), [grids])
  const stock = useMemo(() => (stockFor ? stockFor(visibleDays) : null), [stockFor, visibleDays])

  // Validação do período (usa o cálculo exato do estoque) só para os dias depois da retirada.
  const endOk = useMemo(() => {
    const out = new Map<ISODate, boolean>()
    if (phase !== 'end' || !start) return out
    for (const d of visibleDays) {
      if (d <= start) continue
      const n = diffDays(start, d)
      out.set(d, n >= minDays && n <= maxDays && (!rangeOk || rangeOk(start, d)))
    }
    return out
  }, [phase, start, visibleDays, minDays, maxDays, rangeOk])

  const isDisabled = (d: ISODate): boolean => {
    if (d < minDate || d > maxDate) return true
    if (phase === 'end' && start && d > start) return !endOk.get(d)
    return !!stock && (stock[d] ?? 0) < needed
  }

  const soldOut = (d: ISODate) => !!stock && d >= minDate && (stock[d] ?? 0) < needed

  function select(d: ISODate) {
    if (isDisabled(d)) {
      if (phase === 'end' && start && d > start) {
        const n = diffDays(start, d)
        setHint(
          n < minDays
            ? `O aluguel mínimo é de ${minDays} diárias.`
            : n > maxDays
              ? `O máximo é de ${maxDays} diárias.`
              : 'Não há mala livre no período inteiro. Escolha uma devolução mais cedo.',
        )
      } else if (soldOut(d)) setHint('Sem malas livres nesse dia.')
      return
    }
    setHint(null)
    if (phase === 'start' || !start || d <= start) onChange(d, undefined)
    else onChange(start, d)
  }

  // Mantém o foco do teclado no dia certo quando o mês muda.
  useEffect(() => {
    if (!keyboardNav.current) return
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
    btn?.focus()
  }, [focusDay, view])

  function moveFocus(d: ISODate) {
    if (d < minDate) d = minDate
    if (d > maxDate) d = maxDate
    keyboardNav.current = true
    setFocusDay(d)
    const m = monthStart(d)
    const last = shiftMonth(view, months - 1)
    if (m < view) setView(m)
    else if (m > last) setView(shiftMonth(m, -(months - 1)))
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in map) {
      e.preventDefault()
      moveFocus(addDays(focusDay, map[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const d = fromISO(focusDay)
      d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1))
      moveFocus(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    } else if (e.key === 'Home') {
      e.preventDefault()
      moveFocus(addDays(focusDay, -fromISO(focusDay).getDay()))
    } else if (e.key === 'End') {
      e.preventDefault()
      moveFocus(addDays(focusDay, 6 - fromISO(focusDay).getDay()))
    }
  }

  const canPrev = view > monthStart(minDate)
  const canNext = shiftMonth(view, months - 1) < monthStart(maxDate)
  const tabDay = visibleDays.includes(focusDay) ? focusDay : visibleDays.find((d) => !isDisabled(d)) ?? visibleDays[0]
  const previewEnd = phase === 'end' && hover && start && hover > start && !isDisabled(hover) ? hover : null
  const days = start && end ? diffDays(start, end) : 0

  const instruction =
    hint ??
    (phase === 'start'
      ? start && end
        ? `${formatWeekday(start)} até ${formatWeekday(end)}, ${plural(days, 'diária', 'diárias')}`
        : 'Escolha o dia da retirada'
      : `Agora escolha a devolução (mínimo de ${minDays} diárias)`)

  return (
    <div className={styles.picker}>
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={() => setView(shiftMonth(view, -1))} disabled={!canPrev} aria-label="Mês anterior">
          <CaretLeft size={18} weight="bold" />
        </button>
        <button type="button" className={styles.navBtn} onClick={() => setView(shiftMonth(view, 1))} disabled={!canNext} aria-label="Próximo mês">
          <CaretRight size={18} weight="bold" />
        </button>
      </div>

      <div className={styles.months} ref={gridRef} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)} data-months={months}>
        {shown.map((m, mi) => (
          <div key={m.toISOString()} className={styles.month}>
            <p className={styles.monthName} aria-live="polite">{formatMonth(m)}</p>
            <div className={styles.grid} role="grid" aria-label={formatMonth(m)}>
              <div role="row" className={styles.week}>
                {WEEKDAYS_SHORT.map((w, i) => (
                  <span key={i} role="columnheader" className={styles.wd} aria-label={WEEKDAYS_LONG[i]}>{w}</span>
                ))}
              </div>
              {grids[mi].map((week, wi) => (
                <div role="row" key={wi} className={styles.week}>
                  {week.map((d, di) => {
                    if (!d) return <span key={di} role="gridcell" className={styles.empty} />
                    const disabled = isDisabled(d)
                    const isStart = d === start
                    const isEnd = d === end
                    const inRange = !!(start && end && d > start && d < end)
                    const inPreview = !!(previewEnd && start && d > start && d <= previewEnd)
                    const out = soldOut(d) && !(phase === 'end' && start && d > start)
                    const cls = [
                      styles.day,
                      isStart && styles.start,
                      isStart && !end && !previewEnd && styles.single,
                      isEnd && styles.end,
                      (inRange || inPreview) && styles.range,
                      previewEnd === d && styles.previewEnd,
                      d === today && styles.today,
                      out && styles.soldOut,
                    ]
                      .filter(Boolean)
                      .join(' ')
                    const label = `${formatLong(d)}${isStart ? ', retirada' : ''}${isEnd ? ', devolução' : ''}${out ? ', sem malas livres' : ''}`
                    return (
                      <span role="gridcell" key={di} aria-selected={isStart || isEnd || inRange}>
                        <button
                          type="button"
                          data-day={d}
                          className={cls}
                          aria-disabled={disabled}
                          aria-label={label}
                          tabIndex={d === tabDay ? 0 : -1}
                          onClick={() => {
                            keyboardNav.current = false
                            setFocusDay(d)
                            select(d)
                          }}
                          onMouseEnter={() => setHover(d)}
                          onFocus={() => setHover(d)}
                        >
                          {fromISO(d).getDate()}
                        </button>
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.foot}>
        <p className={`${styles.hint} ${hint ? styles.hintWarn : ''}`} role="status">{instruction}</p>
        <div className={styles.legend} aria-hidden="true">
          <span><i className={styles.lgSel} />Selecionado</span>
          {stockFor && <span><i className={styles.lgOut} />Esgotado</span>}
        </div>
        {(start || end) && (
          <button type="button" className={styles.clear} onClick={() => { setHint(null); onChange(undefined, undefined) }}>
            Limpar datas
          </button>
        )}
      </div>
    </div>
  )
}
