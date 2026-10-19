import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { CaretRight, MagnifyingGlass, Suitcase } from '../components/ui/icons'
import { COLOR_INFO, getModel } from '../data/catalog'
import type { Order } from '../domain/types'
import { formatWeekday, todayISO } from '../lib/dates'
import { money } from '../lib/format'
import { findOrder, listMyOrders } from '../services/orders'
import { useAsync, usePageTitle } from '../state/hooks'
import { EmptyState, Notice, Skeleton, StatusPill } from '../components/ui/Bits'
import { Field } from '../components/ui/Field'
import styles from './MyOrders.module.css'

export function MyOrders() {
  usePageTitle('Minhas reservas')
  const res = useAsync(() => listMyOrders(), [])
  const orders = res.data ?? []
  const today = todayISO()
  const active = orders.filter((o) => ['aguardando_pagamento', 'confirmado', 'com_cliente'].includes(o.status) && o.end >= today)
  const past = orders.filter((o) => !active.includes(o))

  return (
    <div className={`container ${styles.page}`}>
      <h1 className="display h1">Minhas reservas</h1>
      <div className={styles.layout}>
        <div className={styles.lists}>
          {res.status === 'loading' && !res.data ? (
            <div className={styles.skeletons} aria-busy="true">
              <Skeleton h={96} r={18} />
              <Skeleton h={96} r={18} />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={<Suitcase size={36} />} title="Nenhuma reserva neste navegador" action={<Link to="/malas" className="btn btn--blue">Escolher malas</Link>}>
              As reservas feitas neste aparelho aparecem aqui. Fez em outro? Busque pelo código ao lado.
            </EmptyState>
          ) : (
            <>
              {active.length > 0 && <Group title="Próximas e em andamento" orders={active} />}
              {past.length > 0 && <Group title="Anteriores" orders={past} />}
            </>
          )}
        </div>
        <aside>
          <FindForm />
        </aside>
      </div>
    </div>
  )
}

function Group({ title, orders }: { title: string; orders: Order[] }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <ul className={styles.list}>
        {orders.map((o) => (
          <li key={o.code}>
            <Link to={`/pedido/${o.code}`} className={styles.row}>
              <div className={styles.rowMain}>
                <p className={styles.rowTop}>
                  <span className={styles.code}>{o.code}</span>
                  <StatusPill status={o.status} />
                </p>
                <p className={styles.dates}>{formatWeekday(o.start)} até {formatWeekday(o.end)}</p>
                <p className={styles.items}>
                  {o.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${getModel(i.modelId)?.name}${i.color ? ` ${COLOR_INFO[i.color].label}` : ''}`).join(', ')}
                </p>
              </div>
              <p className={`${styles.total} num`}>{money(o.price.total)}</p>
              <CaretRight size={20} aria-hidden="true" className={styles.caret} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FindForm() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || !email.trim()) return setError('Preencha o código e o e-mail usado na reserva.')
    setBusy(true)
    const found = await findOrder(code, email)
    setBusy(false)
    if (found) navigate(`/pedido/${found.code}`)
    else setError('Não encontramos uma reserva com esse código e e-mail.')
  }
  return (
    <form className={styles.find} onSubmit={submit} noValidate>
      <h2 className={styles.groupTitle}>Encontrar uma reserva</h2>
      <Field label="Código da reserva" placeholder="LG7K2PX" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }} autoCapitalize="characters" />
      <Field label="E-mail usado na reserva" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
      {error && <Notice tone="bad">{error}</Notice>}
      <button type="submit" className="btn btn--blue" disabled={busy}>
        <MagnifyingGlass size={18} aria-hidden="true" /> {busy ? 'Buscando...' : 'Buscar reserva'}
      </button>
    </form>
  )
}
