import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { ArrowCounterClockwise, ChartBar, ListChecks, Package, SignOut, Storefront, SunHorizon } from '../../components/ui/icons'
import { BUSINESS } from '../../config/business'
import { resetDemoData } from '../../services/storage'
import { usePageTitle } from '../../state/hooks'
import { BrandMark } from '../../components/layout/Brand'
import { Notice } from '../../components/ui/Bits'
import { useToast } from '../../components/ui/Toast'
import styles from './Admin.module.css'

const KEY = 'luggo:equipe'
const readSession = () => {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function AdminLayout() {
  const [ok, setOk] = useState(readSession)
  const notify = useToast()
  if (!ok) return <AdminGate onEnter={() => setOk(true)} />

  const links = [
    { to: '/equipe', label: 'Hoje', icon: SunHorizon, end: true },
    { to: '/equipe/reservas', label: 'Reservas', icon: ListChecks },
    { to: '/equipe/estoque', label: 'Estoque', icon: Package },
    { to: '/equipe/numeros', label: 'Números', icon: ChartBar },
  ]
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/equipe" className={styles.brand}>
          <BrandMark />
          <span className={styles.brandTag}>Equipe</span>
        </Link>
        <nav className={styles.nav} aria-label="Painel da equipe">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? styles.navActive : undefined)}>
              <l.icon size={20} aria-hidden="true" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <Link to="/" className={styles.sideLink}><Storefront size={18} aria-hidden="true" />Ver o site</Link>
          <button
            type="button"
            className={styles.sideLink}
            onClick={() => {
              resetDemoData(true)
              notify('Dados de demonstração restaurados.')
            }}
          >
            <ArrowCounterClockwise size={18} aria-hidden="true" />Restaurar demonstração
          </button>
          <button
            type="button"
            className={styles.sideLink}
            onClick={() => {
              try {
                sessionStorage.removeItem(KEY)
              } catch {
                /* ignora */
              }
              setOk(false)
            }}
          >
            <SignOut size={18} aria-hidden="true" />Sair
          </button>
        </div>
      </aside>
      <main id="conteudo" className={styles.main}>
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}

function AdminGate({ onEnter }: { onEnter: () => void }) {
  usePageTitle('Área da equipe')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (pin === BUSINESS.adminPin) {
      try {
        sessionStorage.setItem(KEY, '1')
      } catch {
        /* segue sem lembrar */
      }
      onEnter()
    } else {
      setError('PIN incorreto.')
      setPin('')
    }
  }
  return (
    <div className={styles.gate}>
      <form className={styles.gateCard} onSubmit={submit} noValidate>
        <BrandMark className={styles.gateBrand} />
        <h1 className={styles.gateTitle}>Área da equipe</h1>
        <p className={styles.muted}>Reservas do dia, estoque e números da operação.</p>
        <label htmlFor="pin" className={styles.pinLabel}>PIN de acesso</label>
        <input
          id="pin"
          className={styles.pin}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null) }}
          aria-invalid={error ? true : undefined}
          aria-describedby="pin-help"
          autoFocus
        />
        {error ? <Notice tone="bad">{error}</Notice> : <p id="pin-help" className={styles.muted}>Demonstração: o PIN é {BUSINESS.adminPin}.</p>}
        <button type="submit" className="btn btn--blue btn--block" disabled={pin.length < 4}>Entrar</button>
        <Link to="/" className="link">Voltar para o site</Link>
      </form>
    </div>
  )
}
