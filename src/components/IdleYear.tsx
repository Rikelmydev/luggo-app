import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import { BUSINESS } from '../config/business'
import { getModel } from '../data/catalog'
import { YEAR_DAYS, yearUsage } from '../lib/idle'
import { money } from '../lib/format'
import { periodPrice } from '../services/pricing'
import styles from './IdleYear.module.css'

// O ano do calendário começa numa quinta: quatro casas vazias antes de 1º de janeiro.
const OFFSET = 4
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
/** Modelo usado para mostrar quanto o mesmo ano custaria alugando. */
const SAMPLE = 'media-rigida'

/** "Quantos dias por ano a sua mala trabalha?", a mesma conta do site do projeto. */
export function IdleYear() {
  const reduce = useReducedMotion()
  const [trips, setTrips] = useState(2)
  const [length, setLength] = useState(6)
  // Até a seção aparecer, a mala passa o ano inteiro guardada; aí as viagens surgem uma a uma.
  const [started, setStarted] = useState(false)
  const [intro, setIntro] = useState(true)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (reduce) {
      setStarted(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      setStarted(true)
      io.disconnect()
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduce])

  useEffect(() => {
    if (!started) return
    const t = setTimeout(() => setIntro(false), 3500)
    return () => clearTimeout(t)
  }, [started])

  const on = useMemo(() => (started ? yearUsage(trips, length) : new Array<boolean>(YEAR_DAYS).fill(false)), [started, trips, length])
  const used = on.filter(Boolean).length
  const idle = YEAR_DAYS - used
  const model = getModel(SAMPLE)!
  const rentCost = trips * periodPrice(SAMPLE, 1, length)
  let k = 0

  return (
    <section ref={ref} className={styles.idle} aria-labelledby="ano-titulo">
      <div className={`container ${styles.grid}`}>
        <div className={styles.intro} data-reveal>
          <h2 id="ano-titulo" className="display h2">Quantos dias por ano a sua mala trabalha?</h2>
          <p className="lede">Para quem viaja pouco e mora em apartamento pequeno, comprar uma mala boa é um dilema: custa caro, ocupa espaço e fica parada quase o ano todo.</p>
          <div className={styles.controls}>
            <Range id="viagens" label="Viagens por ano" value={trips} min={1} max={8} onChange={setTrips} />
            <Range id="dias-viagem" label="Dias por viagem" value={length} min={BUSINESS.pricing.minDays} max={21} onChange={setLength} />
          </div>
        </div>

        <figure className={styles.chart} data-reveal style={{ '--i': 1 } as CSSProperties}>
          <div className={styles.months} aria-hidden="true">
            {MONTHS.map((m, i) => (
              <span key={m} style={{ gridColumn: `${Math.floor((MONTH_START[i] + OFFSET) / 7) + 1} / span 4` }}>{m}</span>
            ))}
          </div>
          <div className={styles.calendar} role="img" aria-label={`Calendário de ${YEAR_DAYS} dias: a mala viaja ${used} dias e fica guardada ${idle}.`}>
            {Array.from({ length: OFFSET }, (_, i) => <i key={`v${i}`} className={styles.pad} />)}
            {on.map((d, i) => (
              <i key={i} className={d ? styles.on : undefined} style={d && intro ? ({ '--k': k++ } as CSSProperties) : undefined} />
            ))}
          </div>
          <figcaption className={styles.readout}>
            <Flap value={idle} />
            <span className={styles.readoutText}>
              <strong>dias parada no armário</strong>
              <span>
                {started
                  ? `Ela trabalha ${used} dias e fica guardada ${Math.round((idle / YEAR_DAYS) * 100)}% do ano.`
                  : 'Um ano inteiro, esperando a próxima viagem.'}
              </span>
            </span>
          </figcaption>
          {started && (
            <p className={styles.luggo}>
              Com a Luggo, você paga só pelos {used} dias: <strong>{money(rentCost)} no ano</strong> com uma {model.name}, e nada para guardar em casa.
            </p>
          )}
          <div className={styles.legend} aria-hidden="true">
            <span><i className={`${styles.sw} ${styles.swOn}`} />Em viagem</span>
            <span><i className={styles.sw} />Guardada em casa</span>
          </div>
        </figure>
      </div>
    </section>
  )
}

function Range({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className={styles.range}>
      <div className={styles.rangeHead}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(+e.target.value)} style={{ '--fill': fill } as CSSProperties} />
    </div>
  )
}

/** Placar de aeroporto: cada algarismo que muda vira como uma plaqueta. */
function Flap({ value }: { value: number }) {
  const digits = String(value).split('')
  return (
    <span className={styles.flap} aria-hidden="true">
      {digits.map((d, i) => (
        <span key={`${digits.length}-${i}-${d}`} className={styles.digit} style={{ '--i': i } as CSSProperties}>{d}</span>
      ))}
    </span>
  )
}
