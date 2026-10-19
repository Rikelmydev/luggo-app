import { Link, useNavigate } from 'react-router'
import { Suitcase, Trash } from '../components/ui/icons'
import { BUSINESS } from '../config/business'
import { COLOR_INFO, SIZE_INFO, getModel, modelImage } from '../data/catalog'
import { money, moneyShort } from '../lib/format'
import { useBag } from '../state/bag'
import { useDataVersion, usePageTitle } from '../state/hooks'
import { stockAvailable, validatePeriod } from '../services/orders'
import { periodPrice, quote, rentalDays } from '../services/pricing'
import { DatesField } from '../components/DatesField'
import { PriceSummary } from '../components/PriceSummary'
import { EmptyState, Notice, Switch } from '../components/ui/Bits'
import { Stepper } from '../components/ui/Field'
import styles from './BagPage.module.css'

export function BagPage() {
  usePageTitle('Sua reserva')
  const bag = useBag()
  const navigate = useNavigate()
  useDataVersion()

  if (!bag.items.length) {
    return (
      <div className="container">
        <EmptyState
          level={1}
          icon={<Suitcase size={36} />}
          title="Sua reserva está vazia"
          action={<Link to="/malas" className="btn btn--blue">Escolher malas</Link>}
        >
          Escolha as malas e as datas da viagem. Você vê na hora o que está livre.
        </EmptyState>
      </div>
    )
  }

  const hasDates = !!(bag.start && bag.end)
  const periodError = validatePeriod(bag.start, bag.end)
  const valid = !periodError
  const days = valid ? rentalDays(bag.start!, bag.end!) : 0

  const rows = bag.items.map((item) => {
    const model = getModel(item.modelId)!
    const available = valid ? stockAvailable(model.id, item.color, bag.start!, bag.end!) : undefined
    return { item, model, available, short: available !== undefined && available < item.qty }
  })
  const blocked = rows.some((r) => r.short)
  const price = valid
    ? quote({
        items: bag.items.map((i) => ({ modelId: i.modelId, qty: i.qty, colorLabel: i.color ? COLOR_INFO[i.color].label : undefined })),
        start: bag.start!,
        end: bag.end!,
        protection: bag.protection,
        delivery: false,
      })
    : null
  const units = price?.units ?? bag.count
  const { pricing } = BUSINESS

  return (
    <div className={`container ${styles.page}`}>
      <h1 className="display h1">Sua reserva</h1>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="datas-titulo">
            <h2 id="datas-titulo" className={styles.cardTitle}>Datas da viagem</h2>
            <DatesField start={bag.start} end={bag.end} onChange={bag.setDates} />
            {hasDates && periodError && <Notice tone="warn">{periodError}</Notice>}
            {!hasDates && <p className={styles.muted}>Escolha a retirada e a devolução para calcular o preço.</p>}
          </section>

          <section className={styles.card} aria-labelledby="malas-titulo">
            <h2 id="malas-titulo" className={styles.cardTitle}>Malas ({bag.count})</h2>
            <ul className={styles.items}>
              {rows.map(({ item, model, available, short }) => (
                <li key={item.key} className={styles.item}>
                  <Link to={`/malas/${model.id}${item.color ? `?cor=${item.color}` : ''}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                    <img src={modelImage(model, item.color)} alt="" width={760} height={997} />
                  </Link>
                  <div className={styles.info}>
                    <p className={styles.name}>
                      <Link to={`/malas/${model.id}${item.color ? `?cor=${item.color}` : ''}`}>{model.name}</Link>
                    </p>
                    <p className={styles.meta}>
                      {model.kind === 'kit' ? 'Kit, cores sortidas' : `${SIZE_INFO[model.size].label}, ${COLOR_INFO[item.color!].label}`}
                      {' · '}
                      {moneyShort(model.daily)} por dia
                    </p>
                    {short && (
                      <p className={styles.short}>
                        {available === 0 ? 'Esgotada nessas datas.' : `Só ${available} livre${available === 1 ? '' : 's'} nessas datas.`} Ajuste a quantidade ou as datas.
                      </p>
                    )}
                  </div>
                  <div className={styles.controls}>
                    <Stepper value={item.qty} onChange={(n) => bag.setQty(item.key, n)} max={Math.max(item.qty, available ?? 4)} label={`Quantidade de ${model.name}`} />
                    <p className={`${styles.lineTotal} num`}>{days ? money(periodPrice(model.id, item.qty, days)) : '--'}</p>
                    <button type="button" className={styles.remove} onClick={() => bag.remove(item.key)} aria-label={`Remover ${model.name}`}>
                      <Trash size={18} />
                      <span>Remover</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/malas" className="link">Adicionar outra mala</Link>
          </section>

          <section className={styles.card} aria-labelledby="protecao-titulo">
            <h2 id="protecao-titulo" className="sr-only">Proteção</h2>
            <Switch
              checked={bag.protection}
              onChange={bag.setProtection}
              label={`Proteção Luggo, ${moneyShort(pricing.protectionPerDay)} por mala por dia`}
              description={`Cobre danos de uso em rodas, alças, zíperes e casco. ${days ? `Para esta reserva: ${money(pricing.protectionPerDay * units * days)}.` : ''}`}
            />
          </section>
        </div>

        <aside className={styles.side} aria-labelledby="resumo-titulo">
          <div className={styles.summary}>
            <h2 id="resumo-titulo" className={styles.cardTitle}>Resumo</h2>
            {price ? (
              <PriceSummary price={price} deliveryNote="Na próxima etapa" totalLabel="Subtotal" />
            ) : (
              <p className={styles.muted}>O preço aparece quando as datas estiverem certas.</p>
            )}
            <button
              type="button"
              className="btn btn--blue btn--lg btn--block"
              disabled={!valid || blocked}
              onClick={() => navigate('/pagamento')}
            >
              Continuar para o pagamento
            </button>
            {blocked && <p className={styles.short}>Algumas malas não estão livres nessas datas.</p>}
            <p className={styles.fine}>Pix ou cartão pelo Mercado Pago. Cancelamento grátis até {BUSINESS.operations.freeCancelHours}h antes da retirada.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
