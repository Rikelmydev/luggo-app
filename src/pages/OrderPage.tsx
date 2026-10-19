import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { CalendarPlus, ChatCircleText, Printer, SealCheck, WarningCircle, XCircle } from '../components/ui/icons'
import { BUSINESS } from '../config/business'
import { STATUS_INFO, type Order, type OrderStatus } from '../domain/types'
import { addDays, formatDateTime, formatWeekday } from '../lib/dates'
import { firstName, money, plural } from '../lib/format'
import { canCancel, cancelOrder, checkExtension, extendOrder, extensionPrice, getOrder } from '../services/orders'
import { holdsUnits } from '../services/availability'
import { useBag } from '../state/bag'
import { useAsync, usePageTitle } from '../state/hooks'
import { OrderTicket } from '../components/OrderTicket'
import { PaymentModal } from '../components/PaymentModal'
import { PriceSummary } from '../components/PriceSummary'
import { EmptyState, Notice, Skeleton, StatusPill } from '../components/ui/Bits'
import { Stepper } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import styles from './OrderPage.module.css'

export function OrderPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const bag = useBag()
  const res = useAsync(() => getOrder(code), [code])
  usePageTitle(`Reserva ${code.toUpperCase()}`)

  useEffect(() => {
    if ((location.state as { clearBag?: boolean } | null)?.clearBag) bag.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!res.data && res.status === 'loading') {
    return (
      <div className={`container ${styles.page}`} aria-busy="true">
        <Skeleton h={44} w="60%" />
        <div style={{ height: 24 }} />
        <Skeleton h={320} r={20} />
      </div>
    )
  }
  if (!res.data) {
    return (
      <div className="container">
        <EmptyState level={1} icon={<WarningCircle size={36} />} title="Não encontramos essa reserva" action={<Link to="/minhas-reservas" className="btn btn--blue">Buscar minhas reservas</Link>}>
          Confira o código. Ele começa com LG e tem 7 caracteres, como no e-mail de confirmação.
        </EmptyState>
      </div>
    )
  }
  return <OrderView order={res.data} isNew={params.get('novo') === '1'} />
}

function OrderView({ order, isNew }: { order: Order; isNew: boolean }) {
  const notify = useToast()
  const [payOpen, setPayOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const pending = order.status === 'aguardando_pagamento'
  const expired = pending && !holdsUnits(order)
  const cancel = canCancel(order)
  const canExtendNow = ['confirmado', 'com_cliente'].includes(order.status)
  const justConfirmed = isNew && order.status === 'confirmado'

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        {justConfirmed ? (
          <>
            <SealCheck size={44} weight="fill" className={styles.okIcon} aria-hidden="true" />
            <h1 className="display h1">Reserva confirmada, {firstName(order.customer.name)}!</h1>
            <p className="lede">Suas malas estão separadas. Guardamos tudo em <Link to="/minhas-reservas" className="link">Minhas reservas</Link>; mostre o código abaixo na {order.fulfillment.type === 'entrega' ? 'entrega' : 'retirada'}.</p>
          </>
        ) : (
          <>
            <p className={styles.kicker}><StatusPill status={order.status} /></p>
            <h1 className="display h1">Reserva {order.code}</h1>
            <p className={styles.made}>Feita em {formatDateTime(order.createdAt)}</p>
          </>
        )}
      </header>

      {pending && !expired && (
        <div className={styles.alert}>
          <Notice tone="warn">
            Falta pagar. As malas ficam separadas até {new Date(order.payment.expiresAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
          </Notice>
          <button className="btn btn--blue" onClick={() => setPayOpen(true)}>Pagar {money(order.price.total)}</button>
        </div>
      )}
      {expired && (
        <div className={styles.alert}>
          <Notice tone="bad">O prazo para pagar acabou e as malas voltaram para o estoque.</Notice>
          <Link to="/malas" className="btn btn--blue">Fazer nova reserva</Link>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <OrderTicket order={order} stamp={justConfirmed} />

          <section className={styles.card} aria-labelledby="andamento">
            <h2 id="andamento" className={styles.cardTitle}>Andamento</h2>
            <Timeline order={order} />
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.card} aria-labelledby="acoes">
            <h2 id="acoes" className={styles.cardTitle}>O que você pode fazer</h2>
            <div className={styles.actions}>
              {canExtendNow && (
                <button className="btn btn--blue btn--block" onClick={() => setExtendOpen(true)}>
                  <CalendarPlus size={20} aria-hidden="true" /> Ficar mais dias
                </button>
              )}
              {order.status !== 'cancelado' && !expired && (
                cancel.ok ? (
                  <button className="btn btn--ghost btn--block" onClick={() => setCancelOpen(true)}>
                    <XCircle size={20} aria-hidden="true" /> Cancelar reserva
                  </button>
                ) : (
                  cancel.reason && order.status === 'confirmado' && <p className={styles.muted}>{cancel.reason}</p>
                )
              )}
              <button className="btn btn--ghost btn--block" onClick={() => window.print()}>
                <Printer size={20} aria-hidden="true" /> Imprimir
              </button>
              <Link to={`/contato?pedido=${order.code}`} className="btn btn--ghost btn--block">
                <ChatCircleText size={20} aria-hidden="true" /> Falar com a Luggo
              </Link>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="pagamento">
            <h2 id="pagamento" className={styles.cardTitle}>Pagamento</h2>
            <PriceSummary price={order.price} totalLabel={order.payment.status === 'aprovado' ? 'Total pago' : 'Total'} />
            <p className={styles.muted}>
              {order.payment.method === 'pix' ? 'Pix' : 'Cartão de crédito'} pelo Mercado Pago
              {order.payment.paidAt ? `, aprovado em ${formatDateTime(order.payment.paidAt)}` : ''}.
            </p>
            {order.extensions.map((e) => (
              <p key={e.createdAt} className={styles.ext}>
                +{plural(e.days, 'dia', 'dias')} (devolução de {formatWeekday(e.previousEnd)} para {formatWeekday(addDays(e.previousEnd, e.days))}): <strong>{money(e.amount)}</strong>
              </p>
            ))}
          </section>
        </aside>
      </div>

      {pending && !expired && (
        <PaymentModal order={order} open={payOpen} onClose={() => setPayOpen(false)} onPaid={() => { setPayOpen(false); notify('Pagamento aprovado. Reserva confirmada!') }} />
      )}
      {canExtendNow && <ExtendModal order={order} open={extendOpen} onClose={() => setExtendOpen(false)} />}
      <CancelModal order={order} open={cancelOpen} onClose={() => setCancelOpen(false)} refund={cancel.refund} />
    </div>
  )
}

function Timeline({ order }: { order: Order }) {
  const when = (s: OrderStatus) => order.history.find((h) => h.status === s)?.at
  const delivery = order.fulfillment.type === 'entrega'
  const steps: { status: OrderStatus; label: string; detail: string }[] = [
    { status: 'aguardando_pagamento', label: 'Reserva feita', detail: 'As malas foram separadas.' },
    { status: 'confirmado', label: 'Pagamento aprovado', detail: `${delivery ? 'Entrega' : 'Retirada'} em ${formatWeekday(order.start)}.` },
    { status: 'com_cliente', label: delivery ? 'Malas entregues' : 'Malas retiradas', detail: `Boa viagem! ${delivery ? 'Coleta' : 'Devolução'} em ${formatWeekday(order.end)}.` },
    { status: 'devolvido', label: 'Malas devolvidas', detail: 'Agora elas passam pela higienização.' },
    { status: 'concluido', label: 'Aluguel concluído', detail: 'Obrigado por viajar com a Luggo.' },
  ]
  const cancelled = order.history.find((h) => h.status === 'cancelado')
  return (
    <ol className={styles.timeline}>
      {steps.map((s) => {
        const at = when(s.status)
        if (cancelled && !at) return null
        return (
          <li key={s.status} className={at ? styles.tlDone : styles.tlTodo} aria-current={order.status === s.status ? 'step' : undefined}>
            <span className={styles.tlDot} aria-hidden="true" />
            <div>
              <p className={styles.tlLabel}>{s.label}</p>
              <p className={styles.tlDetail}>{at ? `${formatDateTime(at)}. ${s.detail}` : s.detail}</p>
            </div>
          </li>
        )
      })}
      {cancelled && (
        <li className={styles.tlCancel} aria-current="step">
          <span className={styles.tlDot} aria-hidden="true" />
          <div>
            <p className={styles.tlLabel}>{STATUS_INFO.cancelado.label}</p>
            <p className={styles.tlDetail}>{formatDateTime(cancelled.at)}. {cancelled.note}</p>
          </div>
        </li>
      )}
    </ol>
  )
}

function ExtendModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const notify = useToast()
  // Quantos dias cabem antes da próxima reserva das mesmas malas (até 14).
  const maxDays = useMemo(() => {
    let n = 0
    while (n < 14 && !checkExtension(order, n + 1)) n++
    return n
  }, [order])
  const [days, setDays] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) setDays(Math.min(2, Math.max(1, maxDays)))
  }, [open, maxDays])
  const problem = maxDays === 0 ? 'Essas malas já têm outra reserva logo depois da sua devolução, então não dá para estender. Fale com a gente pelo contato.' : checkExtension(order, days)
  const price = extensionPrice(order, days)
  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await extendOrder(order.code, days)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    notify(`Pronto! A nova devolução é ${formatWeekday(res.value.end)}.`)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      title="Ficar mais dias"
      description="Os dias extras saem pela diária cheia, sem desconto. Pago na hora com Pix (simulado)."
      size="sm"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Voltar</button>
          <button className="btn btn--blue" onClick={confirm} disabled={busy || !!problem}>
            {busy ? 'Confirmando...' : `Pagar ${money(price)} e estender`}
          </button>
        </>
      }
    >
      <div className={styles.extend}>
        <div className={styles.extendRow}>
          <span>Dias a mais</span>
          <Stepper value={days} onChange={setDays} min={1} max={Math.max(1, maxDays)} label="Dias a mais" />
        </div>
        <p>
          Devolução passa de <strong>{formatWeekday(order.end)}</strong> para <strong>{formatWeekday(addDays(order.end, days))}</strong>.
        </p>
        {problem ? (
          <Notice tone="warn">{problem}</Notice>
        ) : (
          <Notice tone="ok">
            As mesmas malas estão livres{maxDays < 14 ? ` por até ${plural(maxDays, 'dia', 'dias')} a mais` : ''}. Total: {money(price)}{order.protection ? ', com a Proteção Luggo' : ''}.
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Modal>
  )
}

function CancelModal({ order, open, onClose, refund }: { order: Order; open: boolean; onClose: () => void; refund: boolean }) {
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function confirm() {
    setBusy(true)
    const res = await cancelOrder(order.code)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    notify('Reserva cancelada.')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      size="sm"
      title={`Cancelar a reserva ${order.code}?`}
      description={refund ? `O valor de ${money(order.price.total)} volta pela mesma forma de pagamento em até 2 dias úteis.` : 'A reserva ainda não foi paga, então nada será cobrado.'}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Manter reserva</button>
          <button className="btn btn--danger" onClick={confirm} disabled={busy}>{busy ? 'Cancelando...' : 'Cancelar reserva'}</button>
        </>
      }
    >
      <p className={styles.muted}>As malas voltam para o estoque e podem ser reservadas por outra pessoa. Política: cancelamento grátis até {BUSINESS.operations.freeCancelHours}h antes da retirada.</p>
      {error && <Notice tone="bad">{error}</Notice>}
    </Modal>
  )
}
