import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router'
import { useReducedMotion } from 'motion/react'
import {
  AirplaneTilt,
  ArrowsClockwise,
  Broom,
  CalendarCheck,
  ChatCircleText,
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
import { FAQ, FAQ_HIGHLIGHTS } from '../data/faq'
import { moneyShort } from '../lib/format'
import { useBag } from '../state/bag'
import { usePageTitle } from '../state/hooks'
import { CepCheck } from '../components/CepCheck'
import { IdleYear } from '../components/IdleYear'
import { DatesField } from '../components/DatesField'
import { SuitcaseStage } from '../components/SuitcaseStage'
import { Accordion } from '../components/ui/Accordion'
import travelers from '../assets/img/viajantes.svg'
import styles from './Home.module.css'

const [TRAVELERS_W, TRAVELERS_H] = [900, 1025]

/** Marca um bloco para entrar ao rolar; i atrasa um pouco cada item de uma lista. */
const reveal = (i = 0) => ({ 'data-reveal': '', style: { '--i': i } as CSSProperties })

const SIZE_FILTERS: { value: '' | Size | 'kit'; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'P', label: 'De bordo' },
  { value: 'M', label: 'Média' },
  { value: 'G', label: 'Grande' },
  { value: 'kit', label: 'Kits' },
]

const fromPrice = (size: Size) => Math.min(...MODELS.filter((m) => m.size === size && m.kind !== 'kit').map((m) => m.daily))

/** Desce suavemente até a seção pedida por um link. Ao voltar, vale a posição em que a pessoa estava. */
function useScrollToSection() {
  const { state, key } = useLocation()
  const navigationType = useNavigationType()
  const reduce = useReducedMotion()
  const section = (state as { section?: string } | null)?.section
  useEffect(() => {
    if (!section || navigationType === 'POP') return
    document.getElementById(section)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [section, key, navigationType, reduce])
}

export function Home() {
  usePageTitle('')
  useScrollToSection()
  return (
    <>
      <Hero />
      <Steps />
      <Sizes />
      <Delivery />
      <Included />
      <Faq />
      <IdleYear />
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
            Malas de qualidade por período em São Paulo. Receba em casa ou retire na loja, no caminho da sua viagem.
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
        <h2 id="como-funciona-titulo" className="display h2" {...reveal()}>Como funciona</h2>
        <ol className={styles.stepList}>
          {steps.map((s, i) => (
            <li key={s.title} {...reveal(i + 1)}>
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
    <section id="malas" className={styles.sizesSec} aria-labelledby="tamanhos-titulo">
      <div className={`container ${styles.sizesGrid}`}>
        <div className={styles.sizesCopy} {...reveal()}>
          <h2 id="tamanhos-titulo" className="display h2">Três tamanhos, lado a lado</h2>
          <p className="lede">Em escala real entre si: a de bordo vai na cabine, a média resolve uma semana e a grande aguenta intercâmbio e mudança.</p>
          <Link to="/malas?tamanho=kit" className={styles.kitLink}>
            <Suitcase size={22} aria-hidden="true" />
            <span>
              <strong>Kits Casal e Família</strong> saem até {moneyShort(10)} por dia mais baratos que as malas avulsas
            </span>
          </Link>
          <Link to="/malas" className={`link ${styles.allBags}`}>Ver todas as malas e preços</Link>
        </div>
        <ul className={styles.lineup}>
          {(['P', 'M', 'G'] as Size[]).map((size, i) => (
            <li key={size} {...reveal(i + 1)}>
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
        <h2 id="entrega-titulo" className="display h2" {...reveal()}>Na sua porta e no caminho da viagem</h2>
        <div className={styles.deliveryGrid}>
          <article className={styles.option} {...reveal(1)}>
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
          <article className={`${styles.option} ${styles.optionStore}`} {...reveal(2)}>
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
        <h2 id="inclui-titulo" className="display h2" {...reveal()}>Toda mala Luggo vem assim</h2>
        <ul className={styles.includedList}>
          {items.map((it, i) => (
            <li key={it.title} {...reveal(i + 1)}>
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
  const [all, setAll] = useState(false)
  return (
    <section id="perguntas" className={styles.faq} aria-labelledby="faq-titulo">
      <div className={`container ${styles.faqGrid}`}>
        <div className={styles.faqHead} {...reveal()}>
          <h2 id="faq-titulo" className="display h2">Perguntas que todo mundo faz</h2>
          <p className={styles.faqLede}>Reserva, entrega, pagamento e cuidados com a mala, em respostas curtas.</p>
          <button type="button" className={`link ${styles.allFaq}`} aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? 'Ver menos perguntas' : `Ver todas as ${FAQ.reduce((n, g) => n + g.items.length, 0)} perguntas`}
          </button>
          <div className={styles.faqHelp}>
            <ChatCircleText size={28} className={styles.faqHelpIcon} aria-hidden="true" />
            <div>
              <p className={styles.faqHelpTitle}>Não achou a sua?</p>
              <p>Respondemos em até 1 dia útil.</p>
            </div>
            <Link to="/contato" className="btn btn--blue btn--sm">Fale com a gente</Link>
          </div>
        </div>
        {all ? (
          <div className={styles.faqGroups} {...reveal(1)}>
            {FAQ.map((g) => (
              <div key={g.title}>
                <p className={styles.faqGroupTitle}>{g.title}</p>
                <Accordion items={g.items} />
              </div>
            ))}
          </div>
        ) : (
          <div {...reveal(1)}>
            <Accordion items={FAQ_HIGHLIGHTS} />
          </div>
        )}
      </div>
    </section>
  )
}

function Closing() {
  const mostRented = getModel('media-rigida')!
  const { operations } = BUSINESS
  const facts = [
    { icon: Broom, text: 'Higienizada a cada aluguel' },
    { icon: XCircle, text: `Cancelamento grátis até ${operations.freeCancelHours}h antes` },
    { icon: Truck, text: 'Entrega e coleta em toda a capital' },
  ]
  return (
    <section className={styles.closing}>
      <div className={`container ${styles.closingGrid}`}>
        <div className={styles.closingArt} {...reveal()}>
          <span className={styles.sun} aria-hidden="true" />
          <svg className={styles.route} viewBox="0 0 600 260" aria-hidden="true">
            <path d="M8 240 C 120 40, 380 -10, 560 96" />
            {/* O avião continua a linha, apontado para onde ela segue no fim. */}
            <g className={styles.plane} transform="translate(579 107) rotate(75.5)">
              <AirplaneTilt weight="fill" size={40} x={-20} y={-20} />
            </g>
          </svg>
          <img className={styles.travelers} src={travelers} alt="Ilustração de duas pessoas de mãos dadas, uma puxando uma mala amarela e a outra com câmera e bolsa" width={TRAVELERS_W} height={TRAVELERS_H} loading="lazy" />
        </div>
        <div className={styles.closingCopy} {...reveal(1)}>
          <p className={styles.kicker}>{BUSINESS.tagline}</p>
          <p className={`display ${styles.manifesto}`}>A Luggo não vende malas. Vende a liberdade de viajar.</p>
          <p className={styles.closingLede}>Você paga só os dias da viagem. No resto do ano, a mala fica com a gente, higienizada e pronta para a próxima.</p>
          <div className={styles.closingActions}>
            <Link to="/malas" className="btn btn--blue btn--lg">Escolher minha mala</Link>
            <Link to={`/malas/${mostRented.id}`} className="link">Ver a mais alugada</Link>
          </div>
          <ul className={styles.closingFacts}>
            {facts.map((f) => (
              <li key={f.text}><f.icon size={20} aria-hidden="true" />{f.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
