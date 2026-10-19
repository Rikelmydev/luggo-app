import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CheckCircle, ShieldCheck, Sparkle, Suitcase } from '../components/ui/icons'
import { BUSINESS } from '../config/business'
import { COLOR_INFO, MODELS, SIZE_INFO, getModel, kitListDaily, modelImage, type Color, type Model } from '../data/catalog'
import { moneyShort, plural } from '../lib/format'
import { useBag } from '../state/bag'
import { useDataVersion, usePageTitle } from '../state/hooks'
import { stockAvailable, stockByDay, validatePeriod } from '../services/orders'
import { quote, rentalDays } from '../services/pricing'
import { DatesField } from '../components/DatesField'
import { PriceSummary } from '../components/PriceSummary'
import { ProductCard } from '../components/ProductCard'
import { Notice } from '../components/ui/Bits'
import { Stepper } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { NotFound } from './NotFound'
import styles from './Product.module.css'

export function Product() {
  const { id = '' } = useParams()
  const model = getModel(id)
  if (!model) return <NotFound />
  return <ProductView key={model.id} model={model} />
}

function ProductView({ model }: { model: Model }) {
  usePageTitle(model.name)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const notify = useToast()
  const bag = useBag()
  const version = useDataVersion()
  const isKit = model.kind === 'kit'

  const paramColor = params.get('cor') as Color | null
  const color: Color | undefined = isKit ? undefined : paramColor && model.colors.includes(paramColor) ? paramColor : model.colors[0]
  const setColor = (c: Color) => setParams({ cor: c }, { replace: true })

  const [qty, setQty] = useState(1)
  const hasDates = !!(bag.start && bag.end)
  const periodError = hasDates ? validatePeriod(bag.start, bag.end) : null
  const validDates = hasDates && !periodError
  const days = validDates ? rentalDays(bag.start!, bag.end!) : 0

  const bagKey = `${model.id}:${color ?? 'sortida'}`
  const inBag = bag.items.find((i) => i.key === bagKey)?.qty ?? 0
  const available = useMemo(
    () => (validDates ? stockAvailable(model.id, color, bag.start!, bag.end!) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validDates, model.id, color, bag.start, bag.end, version],
  )
  const canAdd = available === undefined ? 0 : Math.max(0, available - inBag)

  useEffect(() => {
    if (canAdd > 0 && qty > canAdd) setQty(canAdd)
  }, [canAdd, qty])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stockFor = useCallback((ds: string[]) => stockByDay(model.id, color, ds), [model.id, color, version])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rangeOk = useCallback((s: string, e: string) => stockAvailable(model.id, color, s, e) >= qty + inBag, [model.id, color, qty, inBag, version])

  const price = validDates
    ? quote({ items: [{ modelId: model.id, qty, colorLabel: color ? COLOR_INFO[color].label : undefined }], start: bag.start!, end: bag.end!, protection: false, delivery: false })
    : null

  function add() {
    bag.add({ modelId: model.id, color, qty })
    notify(`${qty > 1 ? `${qty} × ` : ''}${model.name}${color ? ` ${COLOR_INFO[color].label}` : ''} na sua reserva`, {
      action: { label: 'Ver reserva', onClick: () => navigate('/reserva') },
    })
  }

  const related = MODELS.filter((m) => m.id !== model.id && (isKit ? m.kind === 'kit' : m.kind === model.kind && m.kind !== 'kit')).slice(0, 3)
  const { operations } = BUSINESS

  return (
    <div className={styles.page}>
      <nav className={`container ${styles.crumbs}`} aria-label="Você está em">
        <Link to="/malas">Malas</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{model.name}</span>
      </nav>

      <div className={`container ${styles.layout}`}>
        <div className={styles.main}>
          <figure className={styles.gallery}>
            <img src={modelImage(model, color)} alt={`${model.name}${color ? ` na cor ${COLOR_INFO[color].label}` : ''}`} width={760} height={997} />
            <figcaption className={styles.badge}>{isKit ? 'Kit' : SIZE_INFO[model.size].label}</figcaption>
          </figure>

          {model.dims && <Dimensions model={model} />}

          <section className={styles.section} aria-labelledby="sobre-titulo">
            <h2 id="sobre-titulo" className="h3">Sobre esta mala</h2>
            <p className={styles.desc}>{model.description}</p>
            <ul className={styles.highlights}>
              {model.highlights.map((h) => (
                <li key={h}><CheckCircle size={20} weight="fill" aria-hidden="true" />{h}</li>
              ))}
            </ul>
          </section>

          {model.contains && (
            <section className={styles.section} aria-labelledby="kit-titulo">
              <h2 id="kit-titulo" className="h3">O que vem no kit</h2>
              <ul className={styles.kitList}>
                {model.contains.map((c) => {
                  const m = getModel(c.modelId)!
                  return (
                    <li key={c.modelId}>
                      <img src={modelImage(m)} alt="" width={760} height={997} loading="lazy" />
                      <div>
                        <p className={styles.kitName}>{c.qty} × <Link to={`/malas/${m.id}`}>{m.name}</Link></p>
                        <p className={styles.muted}>{m.dims?.h} × {m.dims?.w} × {m.dims?.d} cm, {m.allowance?.toLowerCase()}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className={styles.muted}>Avulsas, essas malas custariam {moneyShort(kitListDaily(model))} por dia.</p>
            </section>
          )}

          {!isKit && (
            <section className={styles.section} aria-labelledby="ficha-titulo">
              <h2 id="ficha-titulo" className="h3">Ficha técnica</h2>
              <dl className={styles.specs}>
                <div><dt>Medidas</dt><dd>{model.dims!.h} × {model.dims!.w} × {model.dims!.d} cm{model.dims!.expandsTo ? ` (até ${model.dims!.expandsTo} cm de profundidade expandida)` : ''}</dd></div>
                <div><dt>Capacidade</dt><dd>{model.capacityL} litros{model.capacityExpandedL ? `, ${model.capacityExpandedL} expandida` : ''}</dd></div>
                <div><dt>Peso da mala vazia</dt><dd>{model.weightKg?.toString().replace('.', ',')} kg</dd></div>
                <div><dt>Bagagem</dt><dd>{model.allowance}</dd></div>
                <div><dt>Ideal para</dt><dd>{model.idealFor}</dd></div>
              </dl>
            </section>
          )}
        </div>

        <aside className={styles.panel} aria-labelledby="produto-titulo">
          <div className={styles.panelInner}>
            <h1 id="produto-titulo" className={`display ${styles.title}`}>{model.name}</h1>
            <p className={styles.summary}>{model.summary}</p>
            <p className={styles.daily}>
              <strong className="num">{moneyShort(model.daily)}</strong> por dia
              <span className={styles.dailyNote}>10% off a partir de 7 diárias, 20% a partir de 14</span>
            </p>

            {!isKit && (
              <fieldset className={styles.colors}>
                <legend>Cor: <strong>{color && COLOR_INFO[color].label}</strong></legend>
                <div className={styles.swatches}>
                  {model.colors.map((c) => (
                    <label key={c} className={styles.swatch}>
                      <input type="radio" name="cor" checked={c === color} onChange={() => setColor(c)} />
                      <span style={{ background: COLOR_INFO[c].swatch }} />
                      <span className="sr-only">{COLOR_INFO[c].label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className={styles.block}>
              <p className={styles.blockLabel}>Datas da viagem</p>
              <DatesField start={bag.start} end={bag.end} onChange={bag.setDates} stockFor={stockFor} rangeOk={rangeOk} needed={qty + inBag} />
              {periodError && <Notice tone="warn">{periodError}</Notice>}
              {available !== undefined && (
                <p className={`${styles.stock} ${available === 0 ? styles.out : available <= 1 ? styles.low : ''}`}>
                  {available === 0
                    ? 'Esgotada nessas datas. Tente outra cor ou outras datas.'
                    : `${plural(available, isKit ? 'kit livre' : 'mala livre', isKit ? 'kits livres' : 'malas livres')} nessas datas${inBag ? `, ${inBag} já na sua reserva` : ''}`}
                </p>
              )}
            </div>

            <div className={styles.qtyRow}>
              <span className={styles.blockLabel}>Quantidade</span>
              <Stepper value={qty} onChange={setQty} min={1} max={Math.max(1, canAdd || (validDates ? 1 : 4))} label="Quantidade" />
            </div>

            {price ? (
              <div className={styles.priceBox}>
                <PriceSummary price={price} deliveryNote="No pagamento" totalLabel={`Total por ${plural(days, 'diária', 'diárias')}`} />
              </div>
            ) : (
              <p className={styles.hintDates}>Escolha as datas para ver o preço total do período.</p>
            )}

            <button type="button" className="btn btn--blue btn--lg btn--block" onClick={add} disabled={!validDates || canAdd < qty}>
              <Suitcase size={20} weight="bold" aria-hidden="true" />
              Adicionar à reserva
            </button>
            <ul className={styles.assurances}>
              <li><Sparkle size={18} aria-hidden="true" />Higienizada antes de chegar até você</li>
              <li><ShieldCheck size={18} aria-hidden="true" />Cancelamento grátis até {operations.freeCancelHours}h antes da retirada</li>
            </ul>
            {bag.items.length > 0 && (
              <p className={styles.bagNote}>
                As datas valem para toda a reserva. <Link to="/reserva" className="link">Ver reserva ({bag.count})</Link>
              </p>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className={`container ${styles.related}`} aria-labelledby="relacionados">
          <h2 id="relacionados" className="display h2">{isKit ? 'Outro kit' : 'Outros tamanhos'}</h2>
          <ul className={styles.relatedGrid}>
            {related.map((m) => (
              <li key={m.id}>
                <ProductCard model={m} days={days} available={validDates ? stockAvailable(m.id, undefined, bag.start!, bag.end!) : undefined} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Desenho das medidas em escala (frente e lateral). */
function Dimensions({ model }: { model: Model }) {
  const { h, w, d, expandsTo } = model.dims!
  const k = 2.6
  const fw = w * k
  const fh = h * k
  const sd = d * k
  const ed = (expandsTo ?? d) * k
  const top = 8
  const base = top + 77 * k
  const left = 46
  const gap = 56
  const width = left + fw + gap + ed + 24
  const height = base + 40
  return (
    <figure className={styles.dims}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Medidas: ${h} centímetros de altura, ${w} de largura e ${d} de profundidade`}>
        <g transform={`translate(${left} 0)`}>
          <rect x={0} y={base - fh} width={fw} height={fh} rx={10} className={styles.dimBody} />
          <line x1={-16} y1={base - fh} x2={-16} y2={base} className={styles.dimLine} />
          <text x={-24} y={base - fh / 2} className={styles.dimText} textAnchor="middle" transform={`rotate(-90 ${-24} ${base - fh / 2})`}>{h} cm</text>
          <line x1={0} y1={base + 12} x2={fw} y2={base + 12} className={styles.dimLine} />
          <text x={fw / 2} y={base + 32} className={styles.dimText} textAnchor="middle">{w} cm</text>
          <g transform={`translate(${fw + gap} 0)`}>
            {expandsTo && <rect x={0} y={base - fh} width={ed} height={fh} rx={8} className={styles.dimExpand} />}
            <rect x={0} y={base - fh} width={sd} height={fh} rx={8} className={styles.dimBody} />
            <line x1={0} y1={base + 12} x2={sd} y2={base + 12} className={styles.dimLine} />
            <text x={sd / 2} y={base + 32} className={styles.dimText} textAnchor="middle">{d} cm</text>
          </g>
        </g>
      </svg>
      <figcaption className={styles.dimsCap}>
        Frente e lateral, em escala{expandsTo ? `. A faixa clara mostra a mala expandida (${expandsTo} cm).` : '.'}
      </figcaption>
    </figure>
  )
}
