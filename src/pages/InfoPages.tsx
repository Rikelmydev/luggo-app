import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ArrowUUpLeft,
  Broom,
  CalendarCheck,
  ClockCountdown,
  CreditCard,
  EnvelopeSimple,
  MapPin,
  ShieldCheck,
  Storefront,
  Truck,
  XCircle,
} from '../components/ui/icons'
import { BUSINESS } from '../config/business'
import { FAQ } from '../data/faq'
import { MODELS } from '../data/catalog'
import { isEmail, money, moneyShort } from '../lib/format'
import { sendContact } from '../services/orders'
import { usePageTitle } from '../state/hooks'
import { PageIntro } from '../components/layout/PageIntro'
import { Accordion } from '../components/ui/Accordion'
import { Notice } from '../components/ui/Bits'
import { Field, TextArea } from '../components/ui/Field'
import styles from './InfoPages.module.css'

const { pricing, operations, store } = BUSINESS

/* ---------- Como funciona ---------- */
export function HowItWorks() {
  usePageTitle('Como funciona')
  const steps = [
    { icon: CalendarCheck, title: 'Escolha a mala e as datas', text: `Veja no calendário o que está livre. O mínimo é de ${pricing.minDays} diárias e você reserva com até ${operations.maxAdvanceDays} dias de antecedência.` },
    { icon: CreditCard, title: 'Pague com Pix ou cartão', text: `Pelo Mercado Pago. As malas ficam separadas por ${operations.pixMinutes} minutos enquanto você paga, e a reserva confirma na hora.` },
    { icon: Truck, title: 'Receba em casa ou retire na loja', text: `Entregamos na capital por ${moneyShort(pricing.deliveryFee)} com a coleta, na janela de horário que você escolher. Na loja da Vila Mariana, a retirada é grátis.` },
    { icon: ArrowUUpLeft, title: 'Viaje e devolva', text: 'No último dia, coletamos no mesmo endereço ou você deixa na loja. Pode devolver antes, se voltar mais cedo.' },
    { icon: Broom, title: 'A mala é higienizada', text: `Limpeza interna e externa, revisão de rodas, alças e zíperes. Ela passa ${operations.cleaningDays} dia fora do estoque e volta pronta para a próxima viagem.` },
  ]
  return (
    <>
      <PageIntro title="Como funciona">Do site até a sua porta e de volta, em cinco etapas.</PageIntro>
      <div className={`container ${styles.section}`}>
        <ol className={styles.bigSteps}>
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className={styles.bigNum}>{i + 1}</span>
              <div>
                <h2 className={styles.stepTitle}><s.icon size={26} aria-hidden="true" />{s.title}</h2>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className={styles.policies} aria-labelledby="regras">
          <h2 id="regras" className="display h2">As regras, sem letra miúda</h2>
          <dl className={styles.policyGrid}>
            <div><dt><ClockCountdown size={22} aria-hidden="true" />Desconto por período</dt><dd>10% a partir de 7 diárias e 20% a partir de 14.</dd></div>
            <div><dt><ShieldCheck size={22} aria-hidden="true" />Proteção Luggo</dt><dd>{moneyShort(pricing.protectionPerDay)} por mala por dia. Cobre danos de uso em rodas, alças, zíperes e casco.</dd></div>
            <div><dt><XCircle size={22} aria-hidden="true" />Cancelamento</dt><dd>Grátis até {operations.freeCancelHours} horas antes da retirada, pela página da reserva.</dd></div>
            <div><dt><CalendarCheck size={22} aria-hidden="true" />Ficar mais dias</dt><dd>Peça pela página da reserva: diária cheia, sem desconto. Atraso sem aviso custa a diária com 20% a mais.</dd></div>
          </dl>
          <Link to="/malas" className="btn btn--blue btn--lg">Ver malas disponíveis</Link>
        </section>
      </div>
    </>
  )
}

/* ---------- Perguntas ---------- */
export function FaqPage() {
  usePageTitle('Perguntas frequentes')
  return (
    <>
      <PageIntro title="Perguntas frequentes">
        Não achou a sua? <Link to="/contato">Fale com a gente</Link>.
      </PageIntro>
      <div className={`container ${styles.section} ${styles.faq}`}>
        <nav className={styles.toc} aria-label="Temas">
          {FAQ.map((g) => (
            <a key={g.title} href={`#${slug(g.title)}`}>{g.title}</a>
          ))}
        </nav>
        <div className={styles.faqGroups}>
          {FAQ.map((g) => (
            <section key={g.title} id={slug(g.title)} aria-labelledby={`${slug(g.title)}-t`}>
              <h2 id={`${slug(g.title)}-t`} className="h3">{g.title}</h2>
              <Accordion items={g.items} />
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-')

/* ---------- Termos ---------- */
export function Terms() {
  usePageTitle('Termos de aluguel')
  const repairs = [
    ['Roda quebrada', 60],
    ['Alça telescópica empenada', 85],
    ['Zíper rompido', 45],
    ['Casco trincado', 180],
  ] as const
  return (
    <>
      <PageIntro title="Termos de aluguel">Versão de 1º de outubro de 2026. Documento de exemplo deste projeto demonstrativo.</PageIntro>
      <article className={`container ${styles.section} ${styles.terms}`}>
        <section>
          <h2>1. O que é o aluguel</h2>
          <p>A Luggo empresta malas por um período definido na reserva, entre a retirada (ou entrega) e a devolução (ou coleta). A mala continua sendo da Luggo durante todo o período.</p>
        </section>
        <section>
          <h2>2. Reserva e pagamento</h2>
          <p>A reserva confirma quando o pagamento é aprovado pelo Mercado Pago. Enquanto o pagamento não é feito, as malas ficam separadas por {operations.pixMinutes} minutos. O período mínimo é de {pricing.minDays} diárias.</p>
        </section>
        <section>
          <h2>3. Entrega, retirada e documentos</h2>
          <p>Na retirada ou entrega, a pessoa que fez a reserva mostra um documento com foto e o código da reserva. As entregas acontecem na janela escolhida; se ninguém estiver no endereço, uma nova tentativa custa {money(pricing.deliveryFee)}.</p>
        </section>
        <section>
          <h2>4. Uso e cuidados</h2>
          <p>A mala deve ser usada para transporte de bagagem pessoal. É proibido levar produtos ilegais, perigosos ou perecíveis sem embalagem, e fazer adesivos, pinturas ou furos.</p>
        </section>
        <section>
          <h2>5. Devolução, atraso e extensão</h2>
          <p>A devolução é até o fim do horário da loja (ou da janela de coleta) do último dia. Para ficar mais dias, peça a extensão pela página da reserva: os dias extras custam a diária cheia. Atraso sem aviso custa a diária com {Math.round((pricing.extraDayFactor - 1) * 100)}% a mais, por dia.</p>
        </section>
        <section>
          <h2>6. Danos, extravio e Proteção Luggo</h2>
          <p>Com a Proteção Luggo ({moneyShort(pricing.protectionPerDay)} por mala por dia), danos de uso ficam por conta da Luggo. Sem a proteção, cobramos o reparo:</p>
          <table className={styles.table}>
            <thead><tr><th scope="col">Dano</th><th scope="col">Valor do reparo</th></tr></thead>
            <tbody>
              {repairs.map(([label, value]) => (
                <tr key={label}><td>{label}</td><td className="num">{money(value)}</td></tr>
              ))}
            </tbody>
          </table>
          <p>Em caso de extravio pela companhia aérea, o cliente registra a ocorrência e envia o comprovante. A indenização da companhia é usada para repor a mala; perda total sem indenização segue o valor de reposição do modelo (de {money(320)} a {money(690)}).</p>
        </section>
        <section>
          <h2>7. Cancelamento</h2>
          <p>Cancelamento grátis até {operations.freeCancelHours} horas antes da retirada, com estorno pela mesma forma de pagamento. Depois disso, a reserva não é reembolsável.</p>
        </section>
        <section>
          <h2>8. Dados pessoais</h2>
          <p>Usamos nome, e-mail, celular e endereço só para cumprir a reserva e falar com você sobre ela, conforme a LGPD. Nesta demonstração, os dados ficam salvos apenas no seu navegador.</p>
        </section>
      </article>
    </>
  )
}

/* ---------- Contato ---------- */
export function Contact() {
  usePageTitle('Contato')
  const [params] = useSearchParams()
  const pedido = params.get('pedido') ?? ''
  const [form, setForm] = useState({ name: '', email: '', topic: pedido ? 'Minha reserva' : '', message: pedido ? `Sobre a reserva ${pedido}: ` : '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Digite seu nome.'
    if (!isEmail(form.email)) errs.email = form.email ? 'Confira o e-mail.' : 'Digite seu e-mail.'
    if (!form.topic) errs.topic = 'Escolha um assunto.'
    if (form.message.trim().length < 10) errs.message = 'Conte um pouco mais (pelo menos 10 caracteres).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const msg = await sendContact(form)
    setBusy(false)
    setSent(msg.id)
  }

  return (
    <>
      <PageIntro title="Fale com a gente">Respondemos em até 1 dia útil. Sobre uma reserva? Tenha o código em mãos.</PageIntro>
      <div className={`container ${styles.section} ${styles.contact}`}>
        {sent ? (
          <div className={styles.sent} role="status">
            <EnvelopeSimple size={40} aria-hidden="true" />
            <h2 className="h3">Mensagem enviada</h2>
            <p>O número do seu atendimento é <strong>{sent}</strong>. Nesta demonstração, a mensagem fica salva neste navegador.</p>
            <button className="btn btn--ghost" onClick={() => { setSent(null); setForm({ name: form.name, email: form.email, topic: '', message: '' }) }}>Enviar outra</button>
          </div>
        ) : (
          <form className={styles.contactForm} onSubmit={submit} noValidate>
            <div className={styles.row2}>
              <Field label="Nome" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Field label="E-mail" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className={styles.selectField}>
              <label htmlFor="assunto">Assunto</label>
              <select id="assunto" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} aria-invalid={errors.topic ? true : undefined}>
                <option value="">Escolha</option>
                {['Minha reserva', 'Entrega e coleta', 'Pagamento', 'Dano ou extravio', 'Parcerias', 'Outro assunto'].map((t) => <option key={t}>{t}</option>)}
              </select>
              {errors.topic && <p className={styles.err}>{errors.topic}</p>}
            </div>
            <TextArea label="Mensagem" rows={5} value={form.message} error={errors.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <button type="submit" className="btn btn--blue" disabled={busy}>{busy ? 'Enviando...' : 'Enviar mensagem'}</button>
          </form>
        )}
        <aside className={styles.storeCard}>
          <h2 className={styles.storeTitle}><Storefront size={24} aria-hidden="true" />{store.name}</h2>
          <p><MapPin size={18} aria-hidden="true" />{store.address}</p>
          <p className={styles.muted}>{store.landmark}</p>
          <dl className={styles.hours}>
            {store.hours.map((h) => (<div key={h.days}><dt>{h.days}</dt><dd>{h.time}</dd></div>))}
          </dl>
          <Notice>Precisa cancelar ou ficar mais dias? Dá para fazer direto na <Link to="/minhas-reservas" className="link">página da reserva</Link>.</Notice>
        </aside>
      </div>
    </>
  )
}

/* ---------- Sobre ---------- */
export function About() {
  usePageTitle('Sobre a Luggo')
  const team = [
    { name: 'Enzo', role: 'Cofundador', tone: styles.tagBlue },
    { name: 'Bianca', role: 'Cofundadora', tone: styles.tagYellow },
    { name: 'Rikelmy', role: 'Cofundador', tone: styles.tagDeep },
  ]
  const units = 30
  return (
    <>
      <PageIntro title="A mala que você usa poucas vezes não precisa morar na sua casa" />
      <div className={`container ${styles.section} ${styles.about}`}>
        <div className={styles.aboutText}>
          <p className="lede">Quem viaja uma ou duas vezes por ano compra uma mala boa, usa por alguns dias e guarda o resto do ano num armário que já não tem espaço. Em São Paulo, onde muita gente mora em estúdio ou apartamento dividido, isso pesa.</p>
          <p>A Luggo nasceu em 2026 como projeto de empreendedorismo de três estudantes com uma ideia simples: transformar a mala em serviço. Você aluga pelo tempo da viagem, recebe em casa ou retira perto do metrô, e devolve. Cada mala volta, é higienizada e sai de novo, em vez de ficar parada.</p>
          <p>Começamos com {units} malas de {MODELS.filter((m) => m.kind !== 'kit').length} modelos, uma loja na Vila Mariana e entrega na capital. O próximo passo são totens de autoatendimento em rodoviárias e estações, como Barra Funda e Tietê.</p>
        </div>
        <section aria-labelledby="time">
          <h2 id="time" className="display h2">Quem está por trás</h2>
          <div className={styles.rail} aria-hidden="true" />
          <ul className={styles.tags}>
            {team.map((p, i) => (
              <li key={p.name} className={`${styles.tag} ${p.tone}`} style={{ ['--r' as string]: `${[-4, 3, -2][i]}deg` }}>
                <span className={styles.tagHole} aria-hidden="true" />
                <span className={styles.tagIni} aria-hidden="true">{p.name[0]}</span>
                <strong>{p.name}</strong>
                <span>{p.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
