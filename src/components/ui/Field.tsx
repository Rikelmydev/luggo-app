import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Minus, Plus } from './icons'
import styles from './Field.module.css'

interface BaseProps {
  label: string
  error?: string | null
  hint?: ReactNode
  optional?: boolean
}

export function Field({ label, error, hint, optional, id, className, ...input }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={fid} className={styles.label}>
        {label} {optional && <span className={styles.opt}>(opcional)</span>}
      </label>
      <input
        id={fid}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        {...input}
      />
      {hint && !error && <p id={`${fid}-hint`} className={styles.hint}>{hint}</p>}
      {error && <p id={`${fid}-err`} className={styles.error}>{error}</p>}
    </div>
  )
}

export function TextArea({ label, error, hint, optional, id, ...input }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className={styles.field}>
      <label htmlFor={fid} className={styles.label}>
        {label} {optional && <span className={styles.opt}>(opcional)</span>}
      </label>
      <textarea id={fid} className={`${styles.input} ${styles.area}`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : undefined} {...input} />
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && <p id={`${fid}-err`} className={styles.error}>{error}</p>}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 9,
  label,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <Minus size={18} weight="bold" />
      </button>
      <output aria-live="polite" className="num">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <Plus size={18} weight="bold" />
      </button>
    </div>
  )
}
