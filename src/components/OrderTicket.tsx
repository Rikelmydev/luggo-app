import { QRCodeSVG } from 'qrcode.react'
import { AirplaneTilt } from './ui/icons'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { BUSINESS } from '../config/business'
import { COLOR_INFO, getModel } from '../data/catalog'
import type { Order } from '../domain/types'
import { formatWeekday } from '../lib/dates'
import { plural } from '../lib/format'
import styles from './OrderTicket.module.css'

/** O resumo da reserva como cartão de embarque. */
export function OrderTicket({ order, stamp }: { order: Order; stamp?: boolean }) {
  const reduce = useReducedMotion()
  const f = order.fulfillment
  const win = f.type === 'entrega' ? BUSINESS.operations.deliveryWindows.find((w) => w.id === f.window) : undefined
  const cancelled = order.status === 'cancelado'
  return (
    <article className={`${styles.ticket} ${cancelled ? styles.cancelled : ''}`} aria-label={`Cartão da reserva ${order.code}`}>
      <div className={styles.main}>
        <header className={styles.head}>
          <span className={styles.brand}><AirplaneTilt weight="fill" aria-hidden="true" />Luggo</span>
          <span className={styles.kind}>Cartão de reserva</span>
        </header>
        <dl className={styles.grid}>
          <div className={styles.wide}><dt>Nome</dt><dd>{order.customer.name}</dd></div>
          <div><dt>{f.type === 'entrega' ? 'Entrega' : 'Retirada'}</dt><dd>{formatWeekday(order.start)}</dd></div>
          <div><dt>{f.type === 'entrega' ? 'Coleta' : 'Devolução'}</dt><dd>{formatWeekday(order.end)}</dd></div>
          <div><dt>Diárias</dt><dd className="num">{order.price.days + order.extensions.reduce((n, e) => n + e.days, 0)}</dd></div>
          <div><dt>Malas</dt><dd className="num">{order.price.units}</dd></div>
          <div className={styles.wide}>
            <dt>{f.type === 'entrega' ? 'Endereço' : 'Loja'}</dt>
            <dd>
              {f.type === 'entrega'
                ? `${f.address.street}, ${f.address.number}${f.address.complement ? `, ${f.address.complement}` : ''}, ${f.address.district}`
                : `${BUSINESS.store.name}`}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt>{f.type === 'entrega' ? 'Horário' : 'Horário da loja'}</dt>
            <dd>{win ? `${win.label}, ${win.time}` : BUSINESS.store.hours[0].days + ', ' + BUSINESS.store.hours[0].time}</dd>
          </div>
        </dl>
        <ul className={styles.items}>
          {order.items.map((i) => {
            const m = getModel(i.modelId)!
            return (
              <li key={i.modelId + (i.color ?? '')}>
                {i.qty > 1 ? `${i.qty} × ` : ''}{m.name}{i.color ? `, ${COLOR_INFO[i.color].label}` : ''}
              </li>
            )
          })}
        </ul>
      </div>
      <div className={styles.stub}>
        <div className={styles.qr}>
          <QRCodeSVG value={`LUGGO:${order.code}`} size={112} level="M" marginSize={1} title={`Código ${order.code}`} />
        </div>
        <p className={styles.code}>{order.code}</p>
        <p className={styles.stubNote}>{plural(order.price.units, 'mala', 'malas')}. Mostre este código na {order.fulfillment.type === 'entrega' ? 'entrega' : 'loja'}.</p>
      </div>
      {(stamp || cancelled) && (
        <m.span
          className={`${styles.stamp} ${cancelled ? styles.stampBad : ''}`}
          initial={reduce || cancelled ? false : { scale: 2.4, opacity: 0, rotate: -24 }}
          animate={{ scale: 1, opacity: 1, rotate: -9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.35 }}
          aria-hidden="true"
        >
          {cancelled ? 'Cancelada' : 'Confirmada'}
        </m.span>
      )}
    </article>
  )
}
