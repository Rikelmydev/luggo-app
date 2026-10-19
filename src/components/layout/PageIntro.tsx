import type { ReactNode } from 'react'
import styles from './PageIntro.module.css'

export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={styles.intro}>
      <div className="container">
        <h1 className="display h1">{title}</h1>
        {children && <div className={styles.lede}>{children}</div>}
      </div>
    </header>
  )
}
