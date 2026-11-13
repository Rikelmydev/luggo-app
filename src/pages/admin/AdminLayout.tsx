import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { ArrowCounterClockwise, ChartBar, ListChecks, Package, SignOut, Storefront, SunHorizon } from '../../components/ui/icons'
import { BUSINESS } from '../../config/business'
import { buildSeed } from '../../data/seed'
import { enterStaff, leaveStaff, resetDemo } from '../../services/remote'
import { readDB, resetDemoData } from '../../services/storage'
import { REMOTE } from '../../services/supabase'
import { useAuth } from '../../state/auth'
import { usePageTitle } from '../../state/hooks'
import { AccountLogin } from '../../components/LoginCard'
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
  return REMOTE ? <StaffAccess /> : <DemoAccess />
}

/** Sem Supabase: PIN de demonstração, como antes. */
function DemoAccess() {
  const [ok, setOk] = useState(readSession)
  if (!ok) return <AdminGate onEnter={() => setOk(true)} />
  return (
    <AdminShell
      onReset={async () => {
        resetDemoData(true)
      }}
      onSignOut={() => {
        try {
          sessionStorage.removeItem(KEY)
        } catch {
          /* ignora */
        }
        setOk(false)
      }}
    />
  )
}

/** Com Supabase: conta da equipe. O banco confere o e-mail na tabela staff antes de liberar os pedidos. */
function StaffAccess() {
  usePageTitle('Área da equipe')
  const { session, ready, signOut } = useAuth()
  const [state, setState] = useState<'checking' | 'staff' | 'denied' | 'error'>('checking')
  const email = session?.email

  useEffect(() => {
    if (!email) return
    let alive = true
    setState('checking')
    enterStaff()
      .then(async (ok) => {
        // Primeiro acesso: o estoque ainda está vazio, então cria as malas e os pedidos de exemplo.
        if (ok && readDB().units.length === 0) {
          const seed = buildSeed(new Date())
          await resetDemo(seed.units, seed.orders)
        }
        if (alive) setState(ok ? 'staff' : 'denied')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [email])

  const exit = () => {
    leaveStaff().catch(() => {})
    signOut()
  }

  if (!ready) return <div className={styles.gate} aria-busy="true" />
  if (!session) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateStack}>
          <BrandMark className={styles.gateBrand} />
          <AccountLogin title="Área da equipe" path="equipe" />
          <Link to="/" className="link">Voltar para o site</Link>
        </div>
      </div>
    )
  }
  if (state !== 'staff') {
    return (
      <div className={styles.gate}>
        <div className={styles.gateCard}>
          <BrandMark className={styles.gateBrand} />
          <h1 className={styles.gateTitle}>Área da equipe</h1>
          {state === 'checking' && <p className={styles.muted} aria-live="polite">Conferindo o acesso de {session.email}...</p>}
          {state === 'denied' && <Notice tone="bad">O e-mail {session.email} não faz parte da equipe.</Notice>}
          {state === 'error' && <Notice tone="bad">Não conseguimos falar com o servidor. Confira a internet e recarregue a página.</Notice>}
          {state !== 'checking' && <button type="button" className="btn btn--ghost btn--block" onClick={exit}>Entrar com outra conta</button>}
          <Link to="/" className="link">Voltar para o site</Link>
        </div>
      </div>
    )
  }
  return (
    <AdminShell
      onReset={async () => {
        const seed = buildSeed(new Date())
        await resetDemo(seed.units, seed.orders)
      }}
      onSignOut={exit}
    />
  )
}

function AdminShell({ onReset, onSignOut }: { onReset: () => Promise<void>; onSignOut: () => void }) {
  const notify = useToast()

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
              onReset()
                .then(() => notify('Pedidos de exemplo e estoque restaurados. As reservas do site foram mantidas.'))
                .catch(() => notify('Não deu para restaurar agora. Tente de novo.'))
            }}
          >
            <ArrowCounterClockwise size={18} aria-hidden="true" />Restaurar demonstração
          </button>
          <button
            type="button"
            className={styles.sideLink}
            onClick={onSignOut}
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
