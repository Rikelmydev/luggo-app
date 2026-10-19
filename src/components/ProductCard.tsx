import { useState } from 'react'
import { Link } from 'react-router'
import { COLOR_INFO, SIZE_INFO, kitListDaily, modelImage, type Color, type Model } from '../data/catalog'
import { money, moneyShort, plural } from '../lib/format'
import { periodPrice } from '../services/pricing'
import styles from './ProductCard.module.css'

interface Props {
  model: Model
  days: number
  /** Malas livres nas datas escolhidas (undefined = sem datas). */
  available?: number
}

export function ProductCard({ model, days, available }: Props) {
  const [color, setColor] = useState<Color | undefined>(model.colors[0])
  const href = `/malas/${model.id}${color ? `?cor=${color}` : ''}`
  const soldOut = available === 0
  return (
    <article className={`${styles.card} ${soldOut ? styles.soldOut : ''}`}>
      <Link to={href} className={styles.media} tabIndex={-1} aria-hidden="true">
        <img src={modelImage(model, color)} alt="" width={760} height={997} loading="lazy" />
        <span className={styles.size}>{model.kind === 'kit' ? 'Kit' : SIZE_INFO[model.size].label}</span>
      </Link>
      <div className={styles.body}>
        <h2 className={styles.name}>
          <Link to={href}>{model.name}</Link>
        </h2>
        <p className={styles.spec}>
          {model.dims
            ? `${model.dims.h} × ${model.dims.w} × ${model.dims.d} cm, ${model.capacityExpandedL ? `${model.capacityL} a ${model.capacityExpandedL}` : model.capacityL} L`
            : model.summary}
        </p>

        {model.colors.length > 0 && (
          <div className={styles.swatches} role="radiogroup" aria-label={`Cor da ${model.name}`}>
            {model.colors.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={COLOR_INFO[c].label}
                title={COLOR_INFO[c].label}
                className={styles.swatch}
                style={{ background: COLOR_INFO[c].swatch }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        )}

        <div className={styles.price}>
          <p>
            <strong className="num">{moneyShort(model.daily)}</strong> por dia
            {model.kind === 'kit' && <span className={styles.was}> em vez de {moneyShort(kitListDaily(model))}</span>}
          </p>
          {days > 0 && (
            <p className={styles.period}>
              {money(periodPrice(model.id, 1, days))} por {plural(days, 'diária', 'diárias')}
            </p>
          )}
        </div>

        {available !== undefined && (
          <p className={`${styles.stock} ${soldOut ? styles.stockOut : available === 1 ? styles.stockLow : ''}`}>
            {soldOut
              ? 'Esgotada nessas datas'
              : available === 1
                ? model.kind === 'kit' ? 'Último kit livre nas suas datas' : 'Última livre nas suas datas'
                : `${available} livres nas suas datas`}
          </p>
        )}
      </div>
    </article>
  )
}
