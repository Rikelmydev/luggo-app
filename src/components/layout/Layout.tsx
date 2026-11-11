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
      <ScrollReveal />
    </div>
  )
}

/** Faz os blocos marcados com data-reveal entrarem suavemente quando aparecem na tela. */
function ScrollReveal() {
  useEffect(() => {
    const main = document.getElementById('conteudo')
    if (!main || !('IntersectionObserver' in window)) return
    const root = document.documentElement
    root.classList.add('reveal-on')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.revealed = ''
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    // Páginas novas e conteúdo que chega depois (listas carregadas) também entram.
    const scan = () => main.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => io.observe(el))
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(main, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
      root.classList.remove('reveal-on')
    }
  }, [])
  return null
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
