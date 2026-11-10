import { useState } from 'react'
import type { Order } from '../domain/types'
import { formatDateTime, formatWeekday } from '../lib/dates'
import { reminderTime, returnCountdown, returnDeadline, returnEmail } from '../services/reminders'
import { useNow } from '../state/hooks'
import { EnvelopeSimple } from './ui/icons'
import { Modal } from './ui/Modal'
import styles from './ReturnCountdown.module.css'

export function ReturnCountdown({ order }: { order: Order }) {
  const now = useNow(60_000)
  const [preview, setPreview] = useState(false)
  const count = returnCountdown(order, new Date(now))
  if (!count) return null
  const mail = returnEmail(order)
  const sent = order.returnReminder
  const deadline = `${formatWeekday(order.end)}, até as ${returnDeadline(order).getHours()}h`
  return (
    <section className={styles.card} aria-labelledby="devolucao">
      <h2 id="devolucao" className={styles.title}>Devolução</h2>
      <p className={`${styles.big} ${count.urgent ? styles.urgent : ''}`}>{count.label}</p>
      <p className={styles.when}>{count.late ? `O prazo era ${deadline}. Fale com a gente.` : deadline}</p>
      <div className={styles.mail}>
        <EnvelopeSimple size={20} aria-hidden="true" />
        <p>
          {sent
            ? `Lembrete enviado para ${sent.to} em ${formatDateTime(sent.sentAt)} (simulado).`
            : `Avisamos ${mail.to} 24 horas antes, em ${formatDateTime(reminderTime(order).toISOString())} (simulado).`}{' '}
          <button type="button" className="link" onClick={() => setPreview(true)}>Ver o e-mail</button>
        </p>
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} size="sm" title={mail.subject} description={`Para ${mail.to}. Nesta demonstração, o e-mail não sai de verdade.`}>
        <div className={styles.body}>
          {mail.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
      </Modal>
    </section>
  )
}
