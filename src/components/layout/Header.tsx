import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, List, Suitcase, X } from '../ui/icons'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { reservedCount } from '../../services/orders'
import { useBag } from '../../state/bag'
import { useDB } from '../../state/hooks'
import { BrandMark } from './Brand'
import styles from './Header.module.css'

export function Header({ overHero }: { overHero: boolean }) {
  const { count: inBag } = useBag()
  const { orders } = useDB()
  // O botão soma o que está em montagem com o que já foi pago: confirmar não pode zerar a contagem.
  const count = inBag + reservedCount(orders)
  // Com malas por fechar, abre a reserva em montagem (sem login); senão, as reservas feitas.
  const reservasTo = inBag > 0 ? '/reserva' : '/minhas-reservas'
  const [solid, setSolid] = useState(!overHero)
  const [menu, setMenu] = useState(false)
  const [away, setAway] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const firstCount = useRef(count)
  const hidden = away && !menu

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

  // Some ao descer a página e volta ao primeiro movimento para cima.
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 6) return
      setAway(y > last && y > 120)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // As barras fixas das páginas sobem junto quando o cabeçalho some.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-header-hidden', hidden)
  }, [hidden])

  // Fecha o menu a cada navegação, inclusive para uma seção da própria página.
  useEffect(() => setMenu(false), [location.key])

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

  // Malas desce até a seção da página principal; o catálogo completo segue em /malas.
  const malas = (
    <Link to="/" state={{ section: 'malas' }} preventScrollReset className={location.pathname.startsWith('/malas') ? styles.active : undefined}>
      Malas
    </Link>
  )

  return (
    <>
      <header data-chrome className={`${styles.header} ${solid || menu ? styles.solid : ''} ${hidden ? styles.away : ''}`}>
        <div className={`container ${styles.inner}`}>
          <Link to="/" className={styles.brand} aria-label="Luggo, página inicial">
            <BrandMark />
          </Link>
          {!overHero && (
            <button
              type="button"
              className={styles.back}
              aria-label="Voltar"
              // Quem entrou direto por um link não tem para onde voltar nesta aba: vai ao início.
              onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
            >
              <ArrowLeft size={22} weight="bold" aria-hidden="true" />
            </button>
          )}
          <nav className={styles.links} aria-label="Principal">
            {malas}
            <NavLink to="/como-funciona" className={({ isActive }) => (isActive ? styles.active : undefined)}>
              Como funciona
            </NavLink>
          </nav>
          <Link to={reservasTo} className={styles.bag} aria-label={`Reservas, ${count} ${count === 1 ? 'mala' : 'malas'}`}>
            <Suitcase size={22} weight="bold" aria-hidden="true" />
            <span className={styles.bagLabel}>Reservas</span>
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
          {malas}
          <Link to="/como-funciona">Como funciona</Link>
          <Link to="/sobre">Sobre a Luggo</Link>
          <Link to="/contato">Contato</Link>
          <Link to={reservasTo} className="btn btn--yellow btn--lg">Reservas ({count})</Link>
        </nav>
      </div>
    </>
  )
}
