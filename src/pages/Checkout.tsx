import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { CaretLeft, CheckCircle, CreditCard, PencilSimple, PixLogo, Storefront, Truck } from '../components/ui/icons'
import { BUSINESS, type DeliveryWindowId } from '../config/business'
import { COLOR_INFO, getModel, modelImage } from '../data/catalog'
import type { Order, PaymentMethod } from '../domain/types'
import { addDays, formatWeekday, todayISO } from '../lib/dates'
import { firstName, isEmail, isPhone, maskCep, maskPhone, money, moneyShort, plural } from '../lib/format'
import { inDeliveryArea, lookupCep } from '../services/cep'
import { createOrder, earliestStart, validatePeriod } from '../services/orders'
import { quote, rentalDays } from '../services/pricing'
import { kv } from '../services/storage'
import { useBag } from '../state/bag'
import { usePageTitle } from '../state/hooks'
import { PaymentModal } from '../components/PaymentModal'
import { PriceSummary } from '../components/PriceSummary'
import { Notice } from '../components/ui/Bits'
import { Field } from '../components/ui/Field'
import styles from './Checkout.module.css'

const CUSTOMER_KEY = 'luggo:cliente:v1'

interface AddressForm { cep: string; street: string; number: string; complement: string; district: string; city: string; uf: string }
const emptyAddress: AddressForm = { cep: '', street: '', number: '', complement: '', district: '', city: '', uf: '' }

function loadSaved() {
  try {
    return JSON.parse(kv.get(CUSTOMER_KEY) ?? 'null') as { name: string; email: string; phone: string; address?: AddressForm } | null
  } catch {
    return null
  }
}

export function Checkout() {
  usePageTitle('Pagamento')
  const bag = useBag()
  const navigate = useNavigate()
  const saved = useMemo(loadSaved, [])

  const [step, setStep] = useState(0)
  const [customer, setCustomer] = useState({ name: saved?.name ?? '', email: saved?.email ?? '', phone: saved?.phone ?? '' })
  const [custErr, setCustErr] = useState<Partial<Record<keyof typeof customer, string>>>({})

  const [mode, setMode] = useState<'loja' | 'entrega'>('loja')
  const [address, setAddress] = useState<AddressForm>(saved?.address ?? emptyAddress)
  const [cepState, setCepState] = useState<'idle' | 'loading' | 'found' | 'manual' | 'outside'>(saved?.address?.street ? 'found' : 'idle')
  const [addrErr, setAddrErr] = useState<Partial<Record<keyof AddressForm | 'window', string>>>({})
  const [slot, setSlot] = useState<DeliveryWindowId | ''>('')

  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [terms, setTerms] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)

  const periodError = validatePeriod(bag.start, bag.end)
  if (!order && (!bag.items.length || periodError)) return <Navigate to="/reserva" replace />

  const start = bag.start!
  const end = bag.end!
  const days = rentalDays(start, end)
  const delivery = mode === 'entrega'
  const deliveryTooSoon = delivery && start < earliestStart(true)
  const price = quote({
    items: bag.items.map((i) => ({ modelId: i.modelId, qty: i.qty, colorLabel: i.color ? COLOR_INFO[i.color].label : undefined })),
    start,
    end,
    protection: bag.protection,
    delivery,
  })

  /* ---------- Etapa 1 ---------- */
  function submitCustomer(e: FormEvent) {
    e.preventDefault()
    const errs: typeof custErr = {}
    if (customer.name.trim().split(/\s+/).length < 2) errs.name = 'Digite nome e sobrenome.'
    if (!isEmail(customer.email)) errs.email = customer.email ? 'Esse e-mail parece incompleto. Confira o @ e o domínio.' : 'Digite seu e-mail.'
    if (!isPhone(customer.phone)) errs.phone = 'Digite o celular com DDD.'
    setCustErr(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`cliente-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    setStep(1)
  }

  /* ---------- Etapa 2 ---------- */
  async function findCep(value: string) {
    const masked = maskCep(value)
    setAddress((a) => ({ ...a, cep: masked }))
    if (masked.replace(/\D/g, '').length !== 8) {
      if (cepState !== 'idle') setCepState('idle')
      return
    }
    setCepState('loading')
    setAddrErr({})
    const res = await lookupCep(masked)
    if (res.ok) {
      const a = res.address
      setAddress((cur) => ({ ...cur, cep: a.cep, street: a.street, district: a.district, city: a.city, uf: a.uf }))
      setCepState(inDeliveryArea(a) ? 'found' : 'outside')
      setTimeout(() => document.getElementById('end-numero')?.focus(), 50)
    } else if (res.reason === 'offline') {
      setCepState('manual')
    } else {
      setCepState('idle')
      setAddrErr({ cep: res.reason === 'nao_encontrado' ? 'Não encontramos esse CEP. Confira os números.' : 'CEP inválido.' })
    }
  }

  function submitFulfillment(e: FormEvent) {
    e.preventDefault()
    if (!delivery) return setStep(2)
    const errs: typeof addrErr = {}
    if (address.cep.replace(/\D/g, '').length !== 8) errs.cep = 'Digite o CEP.'
    if (!address.street.trim()) errs.street = 'Digite a rua.'
    if (!address.number.trim()) errs.number = 'Digite o número.'
    if (!address.district.trim()) errs.district = 'Digite o bairro.'
    if (!slot) errs.window = 'Escolha o horário da entrega.'
    if (cepState === 'outside' || (cepState === 'manual' && !inDeliveryArea({ cep: address.cep }))) errs.cep = 'Ainda não entregamos nesse CEP. Escolha retirar na loja.'
    setAddrErr(errs)
    if (Object.keys(errs).length || deliveryTooSoon) return
    setStep(2)
  }

  /* ---------- Etapa 3 ---------- */
  async function submitOrder(e: FormEvent) {
    e.preventDefault()
    if (!terms) {
      setSubmitError('Para continuar, aceite os termos de aluguel.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    const res = await createOrder({
      customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone },
      start,
      end,
      items: bag.items.map((i) => ({ modelId: i.modelId, color: i.color, qty: i.qty })),
      fulfillment: delivery
        ? { type: 'entrega', address: { ...address, city: address.city || 'São Paulo', uf: address.uf || 'SP' }, window: slot as DeliveryWindowId }
        : { type: 'loja' },
      protection: bag.protection,
      method,
    })
    setSubmitting(false)
    if (!res.ok) {
      setSubmitError(res.error)
      return
    }
    kv.set(CUSTOMER_KEY, JSON.stringify({ ...customer, address: delivery ? address : saved?.address }))
    setOrder(res.value)
  }

  // A reserva em montagem é limpa ao chegar na página do pedido (estado clearBag).
  function onPaid(paid: Order) {
    navigate(`/pedido/${paid.code}?novo=1`, { replace: true, state: { clearBag: true } })
  }

  const { store, operations, pricing } = BUSINESS

  return (
    <div className={`container ${styles.page}`}>
      <Link to="/reserva" className={styles.back}><CaretLeft size={16} weight="bold" aria-hidden="true" />Voltar para a reserva</Link>
      <h1 className="display h1">Finalizar reserva</h1>

      <div className={styles.layout}>
        <div className={styles.steps}>
          {/* 1. Dados */}
          <Step n={1} title="Seus dados" active={step === 0} done={step > 0} onEdit={() => setStep(0)}
            summary={<>{customer.name}<br />{customer.email}, {customer.phone}</>}>
            <form onSubmit={submitCustomer} noValidate className={styles.form}>
              <Field id="cliente-name" label="Nome completo" autoComplete="name" value={customer.name} error={custErr.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              <div className={styles.row2}>
                <Field id="cliente-email" label="E-mail" type="email" autoComplete="email" value={customer.email} error={custErr.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                <Field id="cliente-phone" label="Celular" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={customer.phone} error={custErr.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: maskPhone(e.target.value) })} />
              </div>
              <button type="submit" className="btn btn--blue">Continuar</button>
            </form>
          </Step>

          {/* 2. Entrega */}
          <Step n={2} title="Entrega ou retirada" active={step === 1} done={step > 1} onEdit={() => setStep(1)}
            summary={delivery
              ? <>Entrega em {address.street}, {address.number}{address.complement ? `, ${address.complement}` : ''}, {address.district}<br />{operations.deliveryWindows.find((w) => w.id === slot)?.label}, {operations.deliveryWindows.find((w) => w.id === slot)?.time}</>
              : <>Retirada na {store.name}<br />{store.address}</>}>
            <form onSubmit={submitFulfillment} noValidate className={styles.form}>
              <fieldset className={styles.choices}>
                <legend className="sr-only">Como receber</legend>
                <label className={styles.choice}>
                  <input type="radio" name="modo" checked={!delivery} onChange={() => setMode('loja')} />
                  <span>
                    <Storefront size={26} aria-hidden="true" />
                    <strong>Retirar na loja</strong>
                    <small>Grátis. {store.landmark}.</small>
                  </span>
                </label>
                <label className={styles.choice}>
                  <input type="radio" name="modo" checked={delivery} onChange={() => setMode('entrega')} />
                  <span>
                    <Truck size={26} aria-hidden="true" />
                    <strong>Receber em casa</strong>
                    <small>{money(pricing.deliveryFee)} com a coleta. Só na capital.</small>
                  </span>
                </label>
              </fieldset>

              {!delivery && (
                <div className={styles.storeBox}>
                  <p><strong>{store.name}</strong></p>
                  <p>{store.address}</p>
                  <p className={styles.muted}>Retire a partir de {formatWeekday(start)} e devolva até {formatWeekday(end)}, no horário da loja: {store.hours.slice(0, 2).map((h) => `${h.days.toLowerCase()}, ${h.time}`).join('; ')}.</p>
                </div>
              )}

              {delivery && (
                <>
                  {deliveryTooSoon && (
                    <Notice tone="warn">
                      Para entrega em casa, a retirada precisa ser a partir de {formatWeekday(addDays(todayISO(), operations.deliveryLeadDays))}. <Link to="/reserva" className="link">Alterar as datas</Link>
                    </Notice>
                  )}
                  <div className={styles.row3}>
                    <Field id="end-cep" label="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={address.cep}
                      error={addrErr.cep} onChange={(e) => findCep(e.target.value)}
                      hint={cepState === 'loading' ? 'Buscando endereço...' : cepState === 'manual' ? 'Sem conexão com o ViaCEP: preencha o endereço.' : undefined} />
                    {cepState === 'outside' && (
                      <Notice tone="warn">Ainda não entregamos em {address.city}/{address.uf}. Você pode retirar na loja, sem custo.</Notice>
                    )}
                  </div>
                  {(cepState === 'found' || cepState === 'manual') && (
                    <>
                      <div className={styles.row2}>
                        <Field label="Rua" autoComplete="address-line1" value={address.street} error={addrErr.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                        <Field label="Bairro" value={address.district} error={addrErr.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} />
                      </div>
                      <div className={styles.row2}>
                        <Field id="end-numero" label="Número" inputMode="numeric" value={address.number} error={addrErr.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
                        <Field label="Complemento" optional autoComplete="address-line2" placeholder="Apto, bloco" value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
                      </div>
                      <fieldset className={styles.windows}>
                        <legend>Horário da entrega e da coleta</legend>
                        <div className={styles.windowList}>
                          {operations.deliveryWindows.map((w) => (
                            <label key={w.id} className={styles.windowOpt}>
                              <input type="radio" name="janela" checked={slot === w.id} onChange={() => setSlot(w.id)} />
                              <span><strong>{w.label}</strong>{w.time}</span>
                            </label>
                          ))}
                        </div>
                        {addrErr.window && <p className={styles.err}>{addrErr.window}</p>}
                      </fieldset>
                    </>
                  )}
                </>
              )}
              <button type="submit" className="btn btn--blue" disabled={delivery && (deliveryTooSoon || cepState === 'outside' || cepState === 'loading')}>
                Continuar
              </button>
            </form>
          </Step>

          {/* 3. Pagamento */}
          <Step n={3} title="Pagamento" active={step === 2} done={false} onEdit={() => setStep(2)}>
            <form onSubmit={submitOrder} noValidate className={styles.form}>
              <fieldset className={styles.choices}>
                <legend className="sr-only">Forma de pagamento</legend>
                <label className={styles.choice}>
                  <input type="radio" name="pagamento" checked={method === 'pix'} onChange={() => setMethod('pix')} />
                  <span>
                    <PixLogo size={26} aria-hidden="true" />
                    <strong>Pix</strong>
                    <small>Aprovação na hora. O código vale {operations.pixMinutes} minutos.</small>
                  </span>
                </label>
                <label className={styles.choice}>
                  <input type="radio" name="pagamento" checked={method === 'cartao'} onChange={() => setMethod('cartao')} />
                  <span>
                    <CreditCard size={26} aria-hidden="true" />
                    <strong>Cartão de crédito</strong>
                    <small>Pelo Mercado Pago, em ambiente seguro.</small>
                  </span>
                </label>
              </fieldset>
              <label className={styles.terms}>
                <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setSubmitError(null) }} />
                <span>Li e aceito os <Link to="/termos" target="_blank" className="link">termos de aluguel</Link>, incluindo a política de cancelamento e de danos.</span>
              </label>
              {submitError && <Notice tone="bad">{submitError}</Notice>}
              <button type="submit" className="btn btn--blue btn--lg" disabled={submitting}>
                {submitting ? 'Separando suas malas...' : `Pagar ${money(price.total)}`}
              </button>
              <p className={styles.fine}>Ao pagar, as malas ficam separadas para você. Cancelamento grátis até {operations.freeCancelHours}h antes da retirada.</p>
            </form>
          </Step>
        </div>

        <aside className={styles.side} aria-labelledby="resumo-pedido">
          <div className={styles.summary}>
            <h2 id="resumo-pedido" className={styles.sumTitle}>Resumo</h2>
            <p className={styles.trip}>
              <span>{formatWeekday(start)}</span> até <span>{formatWeekday(end)}</span>, {plural(days, 'diária', 'diárias')}
            </p>
            <ul className={styles.sumItems}>
              {bag.items.map((i) => {
                const m = getModel(i.modelId)!
                return (
                  <li key={i.key}>
                    <img src={modelImage(m, i.color)} alt="" width={760} height={997} />
                    <span>{i.qty > 1 ? `${i.qty} × ` : ''}{m.name}{i.color ? `, ${COLOR_INFO[i.color].label}` : ''}</span>
                  </li>
                )
              })}
            </ul>
            <PriceSummary price={price} deliveryNote={delivery ? undefined : 'Retirada grátis'} />
            {bag.protection && <p className={styles.fine}>Proteção Luggo incluída ({moneyShort(pricing.protectionPerDay)} por mala por dia).</p>}
          </div>
        </aside>
      </div>

      {order && (
        <PaymentModal
          order={order}
          open={!!order}
          onClose={() => navigate(`/pedido/${order.code}`, { replace: true, state: { clearBag: true } })}
          onPaid={onPaid}
        />
      )}
      <span className="sr-only" aria-live="polite">{step === 1 ? `Olá, ${firstName(customer.name)}. Agora escolha entrega ou retirada.` : ''}</span>
    </div>
  )
}

function Step({ n, title, active, done, onEdit, summary, children }: { n: number; title: string; active: boolean; done: boolean; onEdit: () => void; summary?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${styles.step} ${active ? styles.stepActive : ''}`} aria-labelledby={`etapa-${n}`}>
      <header className={styles.stepHead}>
        <span className={`${styles.stepNum} ${done ? styles.stepDone : ''}`} aria-hidden="true">
          {done ? <CheckCircle size={20} weight="fill" /> : n}
        </span>
        <h2 id={`etapa-${n}`} className={styles.stepTitle}>{title}</h2>
        {done && !active && (
          <button type="button" className={styles.edit} onClick={onEdit}>
            <PencilSimple size={16} aria-hidden="true" /> Alterar
          </button>
        )}
      </header>
      {active ? children : done && summary ? <p className={styles.stepSummary}>{summary}</p> : null}
    </section>
  )
}
