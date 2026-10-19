import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowsClockwise,
  Broom,
  CalendarCheck,
  CreditCard,
  LockKey,
  ShieldCheck,
  Storefront,
  Suitcase,
  Truck,
  XCircle,
} from '../components/ui/icons'
import { BUSINESS } from '../config/business'
import { COLOR_INFO, MODELS, SIZE_INFO, getModel, type Size } from '../data/catalog'
import { FAQ_HIGHLIGHTS } from '../data/faq'
import { moneyShort } from '../lib/format'
import { useBag } from '../state/bag'
import { usePageTitle } from '../state/hooks'
import { CepCheck } from '../components/CepCheck'
import { DatesField } from '../components/DatesField'
import { SuitcaseStage } from '../components/SuitcaseStage'
import { Accordion } from '../components/ui/Accordion'
import travelers from '../assets/img/viajantes.svg'
import styles from './Home.module.css'

const SIZE_FILTERS: { value: '' | Size | 'kit'; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'P', label: 'De bordo' },
  { value: 'M', label: 'Média' },
  { value: 'G', label: 'Grande' },
  { value: 'kit', label: 'Kits' },
]

const fromPrice = (size: Size) => Math.min(...MODELS.filter((m) => m.size === size && m.kind !== 'kit').map((m) => m.daily))

export function Home() {
  usePageTitle('')
  return (
    <>
      <Hero />
      <Steps />
      <Sizes />
      <Delivery />
      <Included />
      <Faq />
      <Closing />
    </>
  )
}

function Hero() {
  const bag = useBag()
  const navigate = useNavigate()
  const [size, setSize] = useState<'' | Size | 'kit'>('')
  return (
    <section className={styles.hero}>
      <div id="hero-sentinel" className={styles.sentinel} aria-hidden="true" />
      <div className={`container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <h1 className={`display ${styles.heroTitle}`}>
            <span>Alugue a mala.</span> <span>Viaje. Devolva.</span>
          </h1>
          <p className={styles.heroLead}>
            Malas de qualidade por período em São Paulo. Receba em casa ou retire na loja perto do metrô Ana Rosa.
          </p>
          <form
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/malas${size ? `?tamanho=${size}` : ''}`)
            }}
          >
            <DatesField start={bag.start} end={bag.end} onChange={bag.setDates} />
            <fieldset className={styles.sizes}>
              <legend className="sr-only">Tamanho</legend>
              {SIZE_FILTERS.map((f) => (
                <label key={f.value || 'todas'} className={styles.sizeOpt}>
                  <input type="radio" name="tamanho" value={f.value} checked={size === f.value} onChange={() => setSize(f.value)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn btn--blue btn--lg btn--block">
              Ver malas disponíveis
            </button>
          </form>
        </div>
        <div className={styles.heroStage}>
          <SuitcaseStage />
        </div>
      </div>
    </section>
  )
}

function Steps() {
  const steps = [
    { icon: CalendarCheck, title: 'Escolha a mala e as datas', text: 'Pelo site, em dois minutos. Você vê na hora quais malas estão livres.' },
    { icon: CreditCard, title: 'Pague com Pix ou cartão', text: 'Pelo Mercado Pago. A reserva confirma assim que o pagamento é aprovado.' },
    { icon: Truck, title: 'Receba ou retire', text: 'Entregamos em casa na capital, ou você retira na loja da Vila Mariana.' },
    { icon: ArrowsClockwise, title: 'Viaje e devolva', text: 'No último dia, coletamos em casa ou você deixa na loja. Nada para guardar.' },
  ]
  return (
    <section className={styles.steps} aria-labelledby="como-funciona-titulo">
      <div className="container">
        <h2 id="como-funciona-titulo" className="display h2">Como funciona</h2>
        <ol className={styles.stepList}>
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className={styles.stepNum}>{i + 1}</span>
              <s.icon size={30} className={styles.stepIcon} aria-hidden="true" />
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Sizes() {
  const heights: Record<Size, number> = { P: 55, M: 65, G: 76 }
  const sample: Record<Size, keyof typeof COLOR_INFO> = { P: 'azul', M: 'laranja', G: 'grafite' }
  return (
    <section className={styles.sizesSec} aria-labelledby="tamanhos-titulo">
      <div className={`container ${styles.sizesGrid}`}>
        <div className={styles.sizesCopy}>
          <h2 id="tamanhos-titulo" className="display h2">Três tamanhos, lado a lado</h2>
          <p className="lede">Em escala real entre si: a de bordo vai na cabine, a média resolve uma semana e a grande aguenta intercâmbio e mudança.</p>
          <Link to="/malas?tamanho=kit" className={styles.kitLink}>
            <Suitcase size={22} aria-hidden="true" />
            <span>
              <strong>Kits Casal e Família</strong> saem até {moneyShort(10)} por dia mais baratos que as malas avulsas
            </span>
          </Link>
        </div>
        <ul className={styles.lineup}>
          {(['P', 'M', 'G'] as Size[]).map((size) => (
            <li key={size}>
              <Link to={`/malas?tamanho=${size}`} className={styles.sizeCol}>
                <span className={styles.figure}>
                  <img src={COLOR_INFO[sample[size]].image} alt="" width={760} height={997} loading="lazy" />
                </span>
                <span className={styles.sizeName}>{SIZE_INFO[size].label}</span>
                <span className={styles.sizeMeta}>
                  {heights[size]} cm, {SIZE_INFO[size].allowance.toLowerCase()}
                </span>
                <span className={styles.sizePrice}>
                  a partir de <strong>{moneyShort(fromPrice(size))}</strong> por dia
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Delivery() {
  const { pricing, store, operations } = BUSINESS
  return (
    <section className={styles.delivery} aria-labelledby="entrega-titulo">
      <div className="container">
        <h2 id="entrega-titulo" className="display h2">Na sua porta ou no caminho do metrô</h2>
        <div className={styles.deliveryGrid}>
          <article className={styles.option}>
            <Truck size={34} className={styles.optIcon} aria-hidden="true" />
            <h3 className="h3">Entrega e coleta em casa</h3>
            <p className={styles.optPrice}>{moneyShort(pricing.deliveryFee)} por pedido, ida e volta</p>
            <ul className={styles.facts}>
              <li>Toda a capital de São Paulo</li>
              <li>Janelas de {operations.deliveryWindows.map((w) => w.time).join(', ')}</li>
              <li>A partir do dia seguinte à reserva</li>
            </ul>
            <CepCheck />
          </article>
          <article className={`${styles.option} ${styles.optionStore}`}>
            <Storefront size={34} className={styles.optIcon} aria-hidden="true" />
            <h3 className="h3">Retirada na loja</h3>
            <p className={styles.optPrice}>Grátis</p>
            <p>{store.address}</p>
            <p className={styles.muted}>{store.landmark}</p>
            <dl className={styles.hours}>
              {store.hours.map((h) => (
                <div key={h.days}>
                  <dt>{h.days}</dt>
                  <dd>{h.time}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </div>
    </section>
  )
}

function Included() {
  const { pricing, operations } = BUSINESS
  const items = [
    { icon: Broom, title: 'Higienizada a cada aluguel', text: 'Limpeza interna e externa e revisão de rodas e zíperes.' },
    { icon: LockKey, title: 'Cadeado TSA', text: 'Aceito na fiscalização de bagagem dos Estados Unidos.' },
    { icon: ShieldCheck, title: 'Proteção opcional', text: `${moneyShort(pricing.protectionPerDay)} por mala por dia cobre rodas, alças e zíperes.` },
    { icon: XCircle, title: `Cancelamento grátis até ${operations.freeCancelHours}h antes`, text: 'Pela página da reserva, sem falar com ninguém.' },
  ]
  return (
    <section className={styles.included} aria-labelledby="inclui-titulo">
      <div className={`container ${styles.includedGrid}`}>
        <h2 id="inclui-titulo" className="display h2">Toda mala Luggo vem assim</h2>
        <ul className={styles.includedList}>
          {items.map((it) => (
            <li key={it.title}>
              <it.icon size={28} aria-hidden="true" />
              <div>
                <h3>{it.title}</h3>
                <p>{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className={styles.faq} aria-labelledby="faq-titulo">
      <div className={`container ${styles.faqGrid}`}>
        <div>
          <h2 id="faq-titulo" className="display h2">Perguntas que todo mundo faz</h2>
          <Link to="/perguntas" className={`link ${styles.allFaq}`}>Ver todas as perguntas</Link>
        </div>
        <Accordion items={FAQ_HIGHLIGHTS} />
      </div>
    </section>
  )
}

function Closing() {
  const mostRented = getModel('media-rigida')!
  return (
    <section className={styles.closing}>
      <div className={`container ${styles.closingGrid}`}>
        <div className={styles.closingCopy}>
          <p className={`display ${styles.manifesto}`}>A Luggo não vende malas. Vende a liberdade de viajar.</p>
          <div className={styles.closingActions}>
            <Link to="/malas" className="btn btn--blue btn--lg">Escolher minha mala</Link>
            <Link to={`/malas/${mostRented.id}`} className="link">Ver a mais alugada</Link>
          </div>
        </div>
        <img className={styles.travelers} src={travelers} alt="Ilustração de duas pessoas caminhando, uma delas puxando uma mala amarela" width={780} height={718} loading="lazy" />
      </div>
    </section>
  )
}
