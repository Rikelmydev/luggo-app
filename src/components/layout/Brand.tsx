import { AirplaneTilt } from '../ui/icons'
import styles from './Brand.module.css'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`${styles.mark} ${className ?? ''}`}>
      <AirplaneTilt weight="fill" className={styles.plane} aria-hidden="true" />
      <span className={styles.word}>Luggo</span>
    </span>
  )
}

export function Lockup() {
  return (
    <span className={styles.lockup}>
      <AirplaneTilt weight="fill" className={styles.lockPlane} aria-hidden="true" />
      <span className={styles.lockName}>Luggo,</span>
      <span className={styles.lockLine}>Sua mala a pronta entrega</span>
    </span>
  )
}
