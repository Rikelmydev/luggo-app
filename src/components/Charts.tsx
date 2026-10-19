import { useLayoutEffect, useRef, useState } from 'react'
import type { Point } from '../services/stats'
import styles from './Charts.module.css'

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

/** Coluna com topo arredondado (4px) e base reta. */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y
  if (h <= 0) return ''
  const r = Math.min(4, h, w / 2)
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`
}

interface ColumnProps {
  title: string
  data: Point[]
  format: (v: number) => string
  axisFormat?: (v: number) => string
  height?: number
  /** Valor máximo fixo do eixo (ex.: 100 para porcentagem). */
  max?: number
}

export function ColumnChart({ title, data, format, axisFormat = format, height = 240, max }: ColumnProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const top = max ?? niceMax(Math.max(...data.map((d) => d.value)))
  const padL = 52
  const padR = 8
  const padT = 22
  const padB = 28
  const innerW = Math.max(10, width - padL - padR)
  const innerH = height - padT - padB
  const base = padT + innerH
  const slot = innerW / data.length
  const barW = Math.max(3, Math.min(24, slot - 2))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top)
  const every = data.length > 12 ? Math.ceil(data.length / 8) : 1
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  // A última data aparece sempre; o rótulo que ficaria colado nela some.
  const last = data.length - 1
  const showLabel = (i: number) => every === 1 || i === last || (i % every === 0 && last - i >= Math.ceil(every / 2))

  const yOf = (v: number) => padT + innerH * (1 - v / top)
  const xOf = (i: number) => padL + i * slot + (slot - barW) / 2

  return (
    <figure className={styles.figure}>
      <div ref={ref} className={styles.plot} onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? styles.baseline : styles.grid} />
              <text x={padL - 8} y={yOf(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">{axisFormat(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <path key={d.key} d={columnPath(xOf(i), yOf(d.value), barW, base)} className={`${styles.bar} ${hover === i ? styles.barHover : ''}`} />
          ))}
          {data[peak]?.value > 0 && (
            <text x={xOf(peak) + barW / 2} y={yOf(data[peak].value) - 7} className={styles.peak} textAnchor="middle">{format(data[peak].value)}</text>
          )}
          {data.map((d, i) =>
            showLabel(i) ? (
              <text key={d.key} x={xOf(i) + barW / 2} y={height - 8} className={styles.tick} textAnchor="middle">{d.label}</text>
            ) : null,
          )}
          {/* Área de toque maior que a barra: a coluna inteira. */}
          {data.map((d, i) => (
            <rect
              key={d.key}
              x={padL + i * slot}
              y={padT}
              width={slot}
              height={innerH}
              className={styles.hit}
              tabIndex={0}
              aria-label={`${d.label}: ${format(d.value)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className={styles.tip}
            style={{ left: Math.min(width - 80, Math.max(60, xOf(hover) + barW / 2)), top: Math.max(0, yOf(data[hover].value) - 10) }}
            role="presentation"
          >
            <strong>{format(data[hover].value)}</strong>
            <span>{data[hover].label}</span>
          </div>
        )}
      </div>
      <TableView title={title} data={data} format={format} />
    </figure>
  )
}

/** Barras horizontais com o valor na ponta (sem trilho de fundo). */
export function BarList({ title, data, format, suffix }: { title: string; data: (Point & { units?: number })[]; format: (v: number) => string; suffix?: (p: Point & { units?: number }) => string }) {
  const top = niceMax(Math.max(...data.map((d) => d.value)))
  return (
    <figure className={styles.figure}>
      <ul className={styles.barList} aria-label={title}>
        {data.map((d) => (
          <li key={d.key}>
            <span className={styles.barLabel}>{d.label}{suffix && <small>{suffix(d)}</small>}</span>
            <span className={styles.barTrack}>
              <span className={styles.hbar} style={{ width: `${(d.value / top) * 100}%` }} />
              <span className={styles.barValue}>{format(d.value)}</span>
            </span>
          </li>
        ))}
      </ul>
      <TableView title={title} data={data} format={format} />
    </figure>
  )
}

function TableView({ title, data, format }: { title: string; data: Point[]; format: (v: number) => string }) {
  return (
    <details className={styles.table}>
      <summary>Ver como tabela</summary>
      <table>
        <caption className="sr-only">{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td className="num">{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      {note && <p className={styles.statNote}>{note}</p>}
    </div>
  )
}
