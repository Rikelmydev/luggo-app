import { useEffect, useState } from 'react'
import { CalendarBlank } from './ui/icons'
import { BUSINESS } from '../config/business'
import { addDays, diffDays, formatWeekday, todayISO, type ISODate } from '../lib/dates'
import { plural } from '../lib/format'
import { DateRangePicker, type DateRangePickerProps } from './DateRangePicker'
import { Modal } from './ui/Modal'
import styles from './DatesField.module.css'

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

interface DatesFieldProps extends Partial<Pick<DateRangePickerProps, 'stockFor' | 'rangeOk' | 'needed' | 'minDate'>> {
  start?: ISODate
  end?: ISODate
  onChange: (start?: ISODate, end?: ISODate) => void
  variant?: 'light' | 'card'
  label?: string
}

export function DatesField({ start, end, onChange, variant = 'card', label = 'Datas da viagem', minDate, ...pickerProps }: DatesFieldProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<{ start?: ISODate; end?: ISODate }>({ start, end })
  const wide = useMediaQuery('(min-width: 700px)')
  const { pricing, operations } = BUSINESS

  useEffect(() => {
    if (open) setDraft({ start, end })
  }, [open, start, end])

  const days = start && end ? diffDays(start, end) : 0
  const ready = draft.start && draft.end

  return (
    <>
      <button type="button" className={`${styles.field} ${styles[variant]}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CalendarBlank size={22} className={styles.icon} aria-hidden="true" />
        <span className={styles.part}>
          <span className={styles.label}>Retirada</span>
          <span className={styles.value}>{start ? formatWeekday(start) : 'Escolher'}</span>
        </span>
        <span className={styles.sep} aria-hidden="true" />
        <span className={styles.part}>
          <span className={styles.label}>Devolução</span>
          <span className={styles.value}>{end ? formatWeekday(end) : 'Escolher'}</span>
        </span>
        {days > 0 && <span className={styles.days}>{plural(days, 'diária', 'diárias')}</span>}
        <span className="sr-only">{label}, alterar</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Quando é a viagem?"
        description={`Mínimo de ${pricing.minDays} diárias. A mala passa ${operations.cleaningDays} dia em higienização depois de voltar.`}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              type="button"
              className="btn btn--blue"
              disabled={!ready}
              onClick={() => {
                onChange(draft.start, draft.end)
                setOpen(false)
              }}
            >
              Confirmar datas
            </button>
          </>
        }
      >
        <DateRangePicker
          start={draft.start}
          end={draft.end}
          onChange={(s, e) => setDraft({ start: s, end: e })}
          minDate={minDate ?? todayISO()}
          maxDate={addDays(todayISO(), operations.maxAdvanceDays)}
          minDays={pricing.minDays}
          maxDays={operations.maxDays}
          months={wide ? 2 : 1}
          {...pickerProps}
        />
      </Modal>
    </>
  )
}
