import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { List, Suitcase, X } from '../ui/icons'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useBag } from '../../state/bag'
import { BrandMark } from './Brand'
import styles from './Header.module.css'

const LINKS = [
  { to: '/malas', label: 'Malas' },
  { to: '/como-funciona', label: 'Como funciona' },
  { to: '/perguntas', label: 'Perguntas' },
  { to: '/minhas-reservas', label: 'Minhas reservas' },
]

export function Header({ overHero }: { overHero: boolean }) {
  const { count } = useBag()
  const [solid, setSolid] = useState(!overHero)
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  const reduce = useReducedMotion()
  const firstCount = useRef(count)

  // Transparente sobre o azul do início; sólida assim que a página rola.
  useEffect(() => {
    if (!overHero) {
      setSolid(true)
      return
    }
    const sentinel = document.getElementById('hero-sentinel')
    if (!sentinel) return
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting))
    io.observe(sentinel)
    return () => io.disconnect()
  }, [overHero, location.pathname])

  useEffect(() => setMenu(false), [location.pathname])

  useEffect(() => {
    if (!menu) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    const main = document.getElementById('conteudo')
    if (main) main.inert = true
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = ''
      if (main) main.inert = false
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  return (
    <>
      <header data-chrome className={`${styles.header} ${solid || menu ? styles.solid : ''}`}>
        <div className={`container ${styles.inner}`}>
          <Link to="/" className={styles.brand} aria-label="Luggo, página inicial">
            <BrandMark />
          </Link>
          <nav className={styles.links} aria-label="Principal">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/reserva" className={styles.bag} aria-label={`Minha reserva, ${count} ${count === 1 ? 'mala' : 'malas'}`}>
            <Suitcase size={22} weight="bold" aria-hidden="true" />
            <span className={styles.bagLabel}>Reserva</span>
            <m.span
              key={count}
              className={styles.count}
              initial={reduce || count === firstCount.current ? false : { scale: 1.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              aria-hidden="true"
            >
              {count}
            </m.span>
          </Link>
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={menu}
            aria-controls="menu-celular"
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X size={22} /> : <List size={22} />}
            <span className="sr-only">{menu ? 'Fechar menu' : 'Abrir menu'}</span>
          </button>
        </div>
      </header>
      {/* Fora do <header>: o desfoque da barra prenderia um elemento fixo dentro dela. */}
      <div id="menu-celular" className={styles.menu} hidden={!menu}>
        <nav aria-label="Menu">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}>{l.label}</Link>
          ))}
          <Link to="/sobre">Sobre a Luggo</Link>
          <Link to="/contato">Contato</Link>
          <Link to="/reserva" className="btn btn--yellow btn--lg">Ver minha reserva ({count})</Link>
        </nav>
      </div>
    </>
  )
}
