import { Outlet, ScrollRestoration, useLocation } from 'react-router'
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
    </div>
  )
}
