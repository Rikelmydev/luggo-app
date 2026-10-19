import type { PriceBreakdown } from '../domain/types'
import { money, plural } from '../lib/format'
import styles from './PriceSummary.module.css'

interface Props {
  price: PriceBreakdown
  /** Texto no lugar da entrega quando ela ainda não foi escolhida. */
  deliveryNote?: string
  totalLabel?: string
}

export function PriceSummary({ price, deliveryNote, totalLabel = 'Total' }: Props) {
  return (
    <dl className={styles.sum}>
      {price.lines.map((l) => (
        <div key={l.label} className={styles.row}>
          <dt>
            {l.qty > 1 ? `${l.qty} × ` : ''}
            {l.label}
            <span className={styles.sub}>
              {plural(l.days, 'diária', 'diárias')} de {money(l.daily)}
            </span>
          </dt>
          <dd className="num">{money(l.subtotal)}</dd>
        </div>
      ))}
      {price.discount > 0 && (
        <div className={`${styles.row} ${styles.discount}`}>
          <dt>Desconto de {Math.round(price.discountPct * 100)}% por período</dt>
          <dd className="num">−{money(price.discount)}</dd>
        </div>
      )}
      {price.protection > 0 && (
        <div className={styles.row}>
          <dt>Proteção Luggo<span className={styles.sub}>{plural(price.units, 'mala', 'malas')}, {plural(price.days, 'dia', 'dias')}</span></dt>
          <dd className="num">{money(price.protection)}</dd>
        </div>
      )}
      <div className={styles.row}>
        <dt>Entrega e coleta</dt>
        <dd className="num">{deliveryNote ?? (price.delivery > 0 ? money(price.delivery) : 'Grátis')}</dd>
      </div>
      <div className={`${styles.row} ${styles.total}`}>
        <dt>{totalLabel}</dt>
        <dd className="num">{money(price.total)}</dd>
      </div>
    </dl>
  )
}
