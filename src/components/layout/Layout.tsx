import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { sendDueReminders } from '../../services/orders'
import { useNow } from '../../state/hooks'
import { useToast } from '../ui/Toast'
import { Footer } from './Footer'
import { Header } from './Header'
import styles from './Layout.module.css'

export function Layout() {
  const { pathname } = useLocation()
  const overHero = pathname === '/'
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#conteudo">Pular para o conteúdo</a>
      <Header overHero={overHero} />
      <main id="conteudo" className={overHero ? styles.home : styles.page} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
      <ReturnReminders />
    </div>
  )
}

/** Confere a cada minuto se algum lembrete de devolução venceu. */
function ReturnReminders() {
  const notify = useToast()
  const now = useNow(60_000)
  useEffect(() => {
    for (const order of sendDueReminders(new Date(now))) {
      notify(`E-mail enviado para ${order.customer.email}: faltam menos de 24h para devolver a reserva ${order.code}.`)
    }
  }, [now, notify])
  return null
}
