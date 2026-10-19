import { useMemo, useState } from 'react'
import { ArrowRight, MagnifyingGlass, Storefront, Truck, Warning, Wrench } from '../../components/ui/icons'
import { BUSINESS } from '../../config/business'
import { COLOR_INFO, MODELS, getModel } from '../../data/catalog'
import { STATUS_INFO, type Order, type OrderStatus, type Unit } from '../../domain/types'
import { diffDays, formatDateTime, formatLong, formatWeekday, todayISO } from '../../lib/dates'
import { hidePhone, money, moneyShort, plural } from '../../lib/format'
import { NEXT_STATUS, advanceOrder, cancelOrder, setMaintenance } from '../../services/orders'
import { lateFeePerDay, periodPrice } from '../../services/pricing'
import { UNIT_STATE_INFO, kpis, occupancy, rentalsPerModel, revenueByWeek, todayBoard, unitState, type UnitState } from '../../services/stats'
import { useDB, usePageTitle } from '../../state/hooks'
import { BarList, ColumnChart, StatTile } from '../../components/Charts'
import { EmptyState, Notice, StatusPill } from '../../components/ui/Bits'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import styles from './Admin.module.css'

const UNIT_COST = 220

const itemsText = (o: Order) =>
  o.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${getModel(i.modelId)?.name}${i.color ? ` ${COLOR_INFO[i.color].label}` : ''}`).join(', ')

/* ---------- Hoje ---------- */
export function AdminToday() {
  usePageTitle('Hoje | Equipe')
  const db = useDB()
  const board = todayBoard(db.orders)
  const today = todayISO()
  return (
    <>
      <header className={styles.pageHead}>
        <h1 className={styles.h1}>Hoje</h1>
        <p className={styles.muted}>{formatLong(today)}</p>
      </header>
      {board.late.length > 0 && (
        <Notice tone="bad">
          <Warning size={18} weight="fill" aria-hidden="true" /> {plural(board.late.length, 'reserva atrasada', 'reservas atrasadas')} para devolução. Entre em contato com o cliente.
        </Notice>
      )}
      <div className={styles.board}>
        <Column title="Saem hoje" hint="Separar as malas e entregar ou liberar na loja" orders={board.outgoing} />
        <Column title="Voltam hoje" hint="Conferir rodas, alças e zíperes na devolução" orders={[...board.late, ...board.returning]} today={today} />
        <Column title="Em higienização" hint="Concluir para a mala voltar ao estoque" orders={board.cleaning} />
      </div>
      <section className={styles.panel} aria-labelledby="proximos">
        <h2 id="proximos" className={styles.h2}>Próximos 3 dias</h2>
        {board.upcoming.length ? (
          <ul className={styles.compact}>
            {board.upcoming.sort((a, b) => (a.start < b.start ? -1 : 1)).map((o) => (
              <li key={o.code}>
                <span className={styles.code}>{o.code}</span>
                <span>{formatWeekday(o.start)}</span>
                <span className={styles.ellipsis}>{o.customer.name}</span>
                <span className={styles.ellipsis}>{itemsText(o)}</span>
                <span>{o.fulfillment.type === 'entrega' ? 'Entrega' : 'Loja'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhuma saída nos próximos 3 dias.</p>
        )}
      </section>
    </>
  )
}

function Column({ title, hint, orders, today }: { title: string; hint: string; orders: Order[]; today?: string }) {
  return (
    <section className={styles.col} aria-label={title}>
      <header className={styles.colHead}>
        <h2 className={styles.h2}>{title}</h2>
        <span className={styles.count}>{orders.length}</span>
      </header>
      <p className={styles.colHint}>{hint}</p>
      {orders.length ? (
        <ul className={styles.cards}>
          {orders.map((o) => <OrderCard key={o.code} order={o} late={!!today && o.end < today} />)}
        </ul>
      ) : (
        <p className={styles.emptyCol}>Nada por aqui.</p>
      )}
    </section>
  )
}

function OrderCard({ order, late }: { order: Order; late?: boolean }) {
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUS[order.status]
  const f = order.fulfillment
  const win = f.type === 'entrega' ? BUSINESS.operations.deliveryWindows.find((w) => w.id === f.window) : undefined
  const lateDays = late ? diffDays(order.end, todayISO()) : 0
  return (
    <li className={`${styles.card} ${late ? styles.cardLate : ''}`}>
      <p className={styles.cardTop}>
        <span className={styles.code}>{order.code}</span>
        {late ? <span className="pill pill--bad">{plural(lateDays, 'dia', 'dias')} de atraso</span> : <StatusPill status={order.status} />}
      </p>
      <p className={styles.cardName}>{order.customer.name}</p>
      <p className={styles.cardMeta}>
        {f.type === 'entrega' ? <Truck size={16} aria-hidden="true" /> : <Storefront size={16} aria-hidden="true" />}
        {f.type === 'entrega' ? `${f.address.district}, ${win?.label.toLowerCase()} (${win?.time})` : 'Retirada na loja'}
      </p>
      <p className={styles.units}>
        {order.items.flatMap((i) => i.unitIds).map((id) => <span key={id}>{id}</span>)}
      </p>
      {late && <p className={styles.lateFee}>Multa por atraso: {money(lateFeePerDay(order.items) * lateDays)}</p>}
      {next && (
        <button
          type="button"
          className="btn btn--blue btn--sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await advanceOrder(order.code)
            setBusy(false)
            notify(`${order.code}: ${STATUS_INFO[next.to].label.toLowerCase()}`)
          }}
        >
          {busy ? 'Salvando...' : next.action}
        </button>
      )}
    </li>
  )
}

/* ---------- Reservas ---------- */
const FILTERS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'aguardando_pagamento', label: 'Aguardando' },
  { value: 'confirmado', label: 'Confirmadas' },
  { value: 'com_cliente', label: 'Com cliente' },
  { value: 'devolvido', label: 'Higienização' },
  { value: 'concluido', label: 'Concluídas' },
  { value: 'cancelado', label: 'Canceladas' },
]

export function AdminOrders() {
  usePageTitle('Reservas | Equipe')
  const db = useDB()
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(20)
  const [open, setOpen] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': db.orders.length }
    for (const o of db.orders) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [db.orders])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...db.orders]
      .filter((o) => !status || o.status === status)
      .filter((o) => !term || o.code.toLowerCase().includes(term) || o.customer.name.toLowerCase().includes(term) || o.customer.email.includes(term))
      .sort((a, b) => (a.start < b.start ? 1 : -1))
  }, [db.orders, status, q])
  const selected = open ? db.orders.find((o) => o.code === open) : undefined

  return (
    <>
      <header className={styles.pageHead}>
        <h1 className={styles.h1}>Reservas</h1>
        <label className={styles.search}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Código, nome ou e-mail" value={q} onChange={(e) => { setQ(e.target.value); setLimit(20) }} />
        </label>
      </header>
      <div className={styles.filters} role="radiogroup" aria-label="Filtrar por situação">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" role="radio" aria-checked={status === f.value} className={styles.filter} onClick={() => { setStatus(f.value); setLimit(20) }}>
            {f.label} <span className="num">{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {list.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Cliente</th>
                <th scope="col">Período</th>
                <th scope="col">Malas</th>
                <th scope="col">Recebimento</th>
                <th scope="col" className={styles.right}>Total</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((o) => (
                <tr key={o.code} onClick={() => setOpen(o.code)} className={styles.rowLink}>
                  <td>
                    <button type="button" className={styles.codeBtn} onClick={(e) => { e.stopPropagation(); setOpen(o.code) }}>{o.code}</button>
                    {o.source === 'site' && <span className={styles.siteTag}>site</span>}
                  </td>
                  <td>{o.customer.name}</td>
                  <td className={styles.nowrap}>{formatWeekday(o.start)} até {formatWeekday(o.end)}</td>
                  <td className={styles.ellipsis}>{itemsText(o)}</td>
                  <td>{o.fulfillment.type === 'entrega' ? `Entrega, ${o.fulfillment.address.district}` : 'Loja'}</td>
                  <td className={`${styles.right} num`}>{money(o.price.total)}</td>
                  <td><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<MagnifyingGlass size={32} />} title="Nenhuma reserva encontrada">Tente outro filtro ou outra busca.</EmptyState>
      )}
      {list.length > limit && (
        <button type="button" className="btn btn--ghost" onClick={() => setLimit(limit + 20)}>
          Mostrar mais ({list.length - limit})
        </button>
      )}
      {selected && <OrderDetail order={selected} onClose={() => setOpen(null)} />}
    </>
  )
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = NEXT_STATUS[order.status]
  const f = order.fulfillment
  const win = f.type === 'entrega' ? BUSINESS.operations.deliveryWindows.find((w) => w.id === f.window) : undefined
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Reserva ${order.code}`}
      description={`Feita em ${formatDateTime(order.createdAt)}${order.source === 'demo' ? ', dado de demonstração' : ', pelo site'}`}
      footer={
        <>
          {['aguardando_pagamento', 'confirmado'].includes(order.status) && (
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const res = await cancelOrder(order.code)
                setBusy(false)
                if (!res.ok) setError(res.error)
                else notify(`${order.code} cancelada.`)
              }}
            >
              Cancelar reserva
            </button>
          )}
          {next && (
            <button
              type="button"
              className="btn btn--blue"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await advanceOrder(order.code)
                setBusy(false)
                notify(`${order.code}: ${STATUS_INFO[next.to].label.toLowerCase()}`)
              }}
            >
              {next.action}
            </button>
          )}
        </>
      }
    >
      <div className={styles.detail}>
        <p><StatusPill status={order.status} /></p>
        <dl className={styles.detailGrid}>
          <div><dt>Cliente</dt><dd>{order.customer.name}</dd></div>
          <div><dt>Contato</dt><dd>{order.customer.email}<br />{hidePhone(order.customer.phone)}</dd></div>
          <div><dt>Período</dt><dd>{formatWeekday(order.start)} até {formatWeekday(order.end)} ({plural(diffDays(order.start, order.end), 'diária', 'diárias')})</dd></div>
          <div><dt>Recebimento</dt><dd>{f.type === 'entrega' ? <>{f.address.street}, {f.address.number}{f.address.complement ? `, ${f.address.complement}` : ''}<br />{f.address.district}, {win?.label} ({win?.time})</> : 'Retirada na loja'}</dd></div>
          <div><dt>Malas físicas</dt><dd className={styles.units}>{order.items.flatMap((i) => i.unitIds).map((id) => <span key={id}>{id}</span>)}</dd></div>
          <div><dt>Pagamento</dt><dd>{order.payment.method === 'pix' ? 'Pix' : 'Cartão'}, {money(order.price.total)} ({order.payment.status})</dd></div>
        </dl>
        <p className={styles.muted}>{itemsText(order)}{order.protection ? ', com Proteção Luggo' : ''}</p>
        <ol className={styles.history}>
          {order.history.map((h) => (
            <li key={h.status + h.at}><strong>{STATUS_INFO[h.status].label}</strong> <span>{formatDateTime(h.at)}</span>{h.note && <em> {h.note}</em>}</li>
          ))}
        </ol>
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Modal>
  )
}

/* ---------- Estoque ---------- */
export function AdminStock() {
  usePageTitle('Estoque | Equipe')
  const db = useDB()
  const [editing, setEditing] = useState<Unit | null>(null)
  const states = useMemo(() => new Map(db.units.map((u) => [u.id, unitState(u, db.orders)])), [db])
  const totals = useMemo(() => {
    const t: Partial<Record<UnitState, number>> = {}
    for (const s of states.values()) t[s.state] = (t[s.state] ?? 0) + 1
    return t
  }, [states])

  return (
    <>
      <header className={styles.pageHead}>
        <h1 className={styles.h1}>Estoque</h1>
        <p className={styles.muted}>{db.units.length} malas físicas</p>
      </header>
      <ul className={styles.stateSummary}>
        {(Object.keys(UNIT_STATE_INFO) as UnitState[]).map((s) => (
          <li key={s}><span className={`pill pill--${UNIT_STATE_INFO[s].tone}`}>{UNIT_STATE_INFO[s].label}</span> <strong className="num">{totals[s] ?? 0}</strong></li>
        ))}
      </ul>
      {MODELS.filter((m) => m.kind !== 'kit').map((m) => {
        const units = db.units.filter((u) => u.modelId === m.id)
        return (
          <section key={m.id} className={styles.stockGroup} aria-labelledby={`g-${m.id}`}>
            <h2 id={`g-${m.id}`} className={styles.h2}>{m.name} <span className={styles.muted}>{units.length} malas, {moneyShort(m.daily)} por dia</span></h2>
            <ul className={styles.unitGrid}>
              {units.map((u) => {
                const st = states.get(u.id)!
                const info = UNIT_STATE_INFO[st.state]
                return (
                  <li key={u.id} className={styles.unit}>
                    <p className={styles.unitTop}>
                      <span className={styles.code}>{u.id}</span>
                      <span className={styles.dot} style={{ background: COLOR_INFO[u.color].swatch }} title={COLOR_INFO[u.color].label} />
                    </p>
                    <span className={`pill pill--${info.tone}`}>{info.label}</span>
                    <p className={styles.unitInfo}>
                      {st.state === 'com_cliente' && st.order && `Volta ${formatWeekday(st.order.end)}`}
                      {st.state === 'higienizacao' && 'Libera amanhã'}
                      {st.state === 'manutencao' && (u.note ?? 'Em reparo')}
                      {(st.state === 'livre' || st.state === 'reservada') && (st.next ? `Próxima saída ${formatWeekday(st.next.start)}` : 'Sem reservas futuras')}
                    </p>
                    <p className={styles.unitRentals}>{plural(st.rentals, 'aluguel', 'aluguéis')}</p>
                    <button type="button" className={styles.unitBtn} onClick={() => setEditing(u)}>
                      <Wrench size={16} aria-hidden="true" /> {u.maintenance ? 'Liberar' : 'Manutenção'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {editing && <MaintenanceModal unit={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function MaintenanceModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const notify = useToast()
  const [note, setNote] = useState(unit.note ?? '')
  const [busy, setBusy] = useState(false)
  const turningOn = !unit.maintenance
  async function save() {
    setBusy(true)
    await setMaintenance(unit.id, turningOn, note.trim() || 'Em reparo')
    setBusy(false)
    notify(turningOn ? `${unit.id} em manutenção. Ela some do calendário até ser liberada.` : `${unit.id} de volta ao estoque.`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={turningOn ? `Mandar ${unit.id} para manutenção` : `Liberar ${unit.id}`}
      description={turningOn ? 'Reservas já feitas continuam com esta mala; confira se há alguma próxima.' : 'A mala volta a aparecer como livre no site.'}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Voltar</button>
          <button type="button" className="btn btn--blue" onClick={save} disabled={busy}>{busy ? 'Salvando...' : turningOn ? 'Confirmar manutenção' : 'Liberar mala'}</button>
        </>
      }
    >
      {turningOn && <Field label="O que aconteceu" placeholder="Ex.: zíper frontal travando" value={note} onChange={(e) => setNote(e.target.value)} />}
    </Modal>
  )
}

/* ---------- Números ---------- */
export function AdminNumbers() {
  usePageTitle('Números | Equipe')
  const db = useDB()
  const today = todayISO()
  const k = kpis(db.units, db.orders, today)
  const weeks = revenueByWeek(db.orders, 10, today)
  const occ = occupancy(db.units, db.orders, today, 30)
  const perModel = rentalsPerModel(db.units, db.orders)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())
  return (
    <>
      <header className={styles.pageHead}>
        <h1 className={styles.h1}>Números</h1>
        <p className={styles.muted}>Dados de demonstração, gerados a partir dos pedidos fictícios.</p>
      </header>
      <div className={styles.stats}>
        <StatTile label={`Receita em ${month}`} value={money(k.revenue)} note={plural(k.ordersThisMonth, 'reserva paga', 'reservas pagas')} />
        <StatTile label="Reservas ativas" value={String(k.active)} note="Confirmadas e com cliente" />
        <StatTile label="Ocupação, próximos 30 dias" value={`${k.occAvg}%`} note="Média das malas com cliente" />
        <StatTile label="Ticket médio" value={money(k.ticket)} note={`Reservas pagas em ${month}`} />
      </div>
      <section className={styles.panel} aria-labelledby="receita">
        <h2 id="receita" className={styles.h2}>Receita por semana</h2>
        <p className={styles.muted}>Últimas 10 semanas, pelo dia do pagamento.</p>
        <ColumnChart title="Receita por semana" data={weeks} format={(v) => money(v)} axisFormat={(v) => moneyShort(Math.round(v))} />
      </section>
      <div className={styles.twoCols}>
        <section className={styles.panel} aria-labelledby="ocupacao">
          <h2 id="ocupacao" className={styles.h2}>Ocupação nos próximos 30 dias</h2>
          <p className={styles.muted}>Parte do estoque com cliente ou reservada, por dia.</p>
          <ColumnChart title="Ocupação nos próximos 30 dias" data={occ} format={(v) => `${v}%`} max={100} height={200} />
        </section>
        <section className={styles.panel} aria-labelledby="por-mala">
          <h2 id="por-mala" className={styles.h2}>Aluguéis por mala</h2>
          <p className={styles.muted}>Média de aluguéis de cada mala física, por modelo. É o número que diz se o estoque se paga.</p>
          <BarList title="Aluguéis por mala" data={perModel} format={(v) => v.toString().replace('.', ',')} suffix={(p) => `${plural(p.units ?? 0, 'mala', 'malas')}`} />
        </section>
      </div>
      <p className={styles.muted}>
        <ArrowRight size={14} aria-hidden="true" /> Uma Média Rígida custa cerca de {money(UNIT_COST)} no atacado (valor de exemplo). Alugada por uma semana, rende {money(periodPrice('media-rigida', 1, 7))}: com {plural(Math.ceil(UNIT_COST / periodPrice('media-rigida', 1, 7)), 'aluguel', 'aluguéis')} assim, ela se paga.
      </p>
    </>
  )
}
