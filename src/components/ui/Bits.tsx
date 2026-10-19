import type { ReactNode } from 'react'
import { STATUS_INFO, type OrderStatus } from '../../domain/types'
import styles from './Bits.module.css'

export function StatusPill({ status }: { status: OrderStatus }) {
  const info = STATUS_INFO[status]
  return <span className={`pill pill--${info.tone}`}>{info.label}</span>
}

export function EmptyState({ icon, title, children, action, level = 2 }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon} aria-hidden="true">{icon}</div>}
      <Heading className={styles.emptyTitle}>{title}</Heading>
      {children && <div className={styles.emptyText}>{children}</div>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  )
}

export function Skeleton({ h = 20, w = '100%', r = 10 }: { h?: number | string; w?: number | string; r?: number }) {
  return <span className={styles.skeleton} style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <label className={styles.switchRow}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className={styles.switchInput} />
      <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {description && <span className={styles.switchDesc}>{description}</span>}
      </span>
    </label>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return <div className={`${styles.notice} ${styles[tone]}`} role={tone === 'bad' ? 'alert' : undefined}>{children}</div>
}
