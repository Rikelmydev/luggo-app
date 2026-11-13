import { useState, type ComponentType, type FormEvent } from 'react'
import { REMOTE, GOOGLE_LOGIN } from '../services/supabase'
import { isEmail } from '../lib/format'
import { CUSTOMER_KEY, kv } from '../services/storage'
import { useAuth, type AuthProvider } from '../state/auth'
import { AppleLogo, EnvelopeSimple, GoogleLogo, type IconProps } from './ui/icons'
import { Notice } from './ui/Bits'
import { Field } from './ui/Field'
import styles from './LoginCard.module.css'

const PROVIDERS: { id: AuthProvider; name: string; icon: ComponentType<IconProps>; weight: IconProps['weight'] }[] = [
  { id: 'google', name: 'Google', icon: GoogleLogo, weight: 'bold' },
  { id: 'apple', name: 'Apple', icon: AppleLogo, weight: 'fill' },
  { id: 'email', name: 'e-mail', icon: EnvelopeSimple, weight: 'regular' },
]

/** Preenche com o último cliente deste navegador, para a demonstração andar em um clique. */
function lastCustomer(): { name: string; email: string } {
  try {
    const saved = JSON.parse(kv.get(CUSTOMER_KEY) ?? 'null') as { name?: string; email?: string } | null
    return { name: saved?.name ?? '', email: saved?.email ?? '' }
  } catch {
    return { name: '', email: '' }
  }
}

export function LoginCard() {
  return REMOTE ? <AccountLogin title="Entre para ver suas reservas" path="minhas-reservas" signUp /> : <DemoLogin />
}

/** Login de verdade: e-mail e senha (e Google, quando ativado no Supabase). */
export function AccountLogin({ title, path, signUp: canSignUp = false }: { title: string; path: string; signUp?: boolean }) {
  const auth = useAuth()
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [form, setForm] = useState(() => ({ ...lastCustomer(), password: '' }))
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const creating = canSignUp && mode === 'criar'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (creating && !form.name.trim()) errs.name = 'Digite seu nome.'
    if (!isEmail(form.email)) errs.email = form.email ? 'Confira o e-mail.' : 'Digite seu e-mail.'
    if (form.password.length < 6) errs.password = 'A senha tem pelo menos 6 caracteres.'
    setErrors(errs)
    setError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    if (creating) {
      const res = await auth.signUp(form.name, form.email, form.password)
      setError(res.error)
      if (res.confirm) setInfo(`Enviamos um link de confirmação para ${form.email.trim()}. Depois de confirmar, é só entrar.`)
    } else {
      setError(await auth.signInWithPassword(form.email, form.password))
    }
    setBusy(false)
  }

  async function google() {
    setError(await auth.signInWithGoogle(path))
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  return (
    <section className={styles.card} aria-labelledby="login-titulo">
      <h2 id="login-titulo" className="h3">{title}</h2>
      {canSignUp && (
        <div className={styles.switch} role="tablist" aria-label="Conta">
          <button type="button" role="tab" aria-selected={mode === 'entrar'} onClick={() => { setMode('entrar'); setError(null) }}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'criar'} onClick={() => { setMode('criar'); setError(null) }}>Criar conta</button>
        </div>
      )}
      {info ? (
        <Notice tone="ok">{info}</Notice>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          {creating && <Field label="Nome" autoComplete="name" value={form.name} error={errors.name} onChange={set('name')} />}
          <Field label="E-mail" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={set('email')} />
          <Field
            label="Senha"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={form.password}
            error={errors.password}
            hint={creating ? 'Pelo menos 6 caracteres.' : undefined}
            onChange={set('password')}
          />
          {error && <Notice tone="bad">{error}</Notice>}
          <button type="submit" className="btn btn--blue btn--block" disabled={busy}>
            {busy ? 'Aguarde...' : creating ? 'Criar conta e entrar' : 'Entrar'}
          </button>
        </form>
      )}
      {GOOGLE_LOGIN && !info && (
        <button type="button" className="btn btn--ghost btn--block" onClick={google}>
          <GoogleLogo size={20} weight="bold" aria-hidden="true" /> Continuar com Google
        </button>
      )}
      {canSignUp && <p className={styles.note}>Sua conta guarda as reservas feitas com o mesmo e-mail. Entre em qualquer aparelho para ver.</p>}
    </section>
  )
}

function DemoLogin() {
  const { signIn } = useAuth()
  const [provider, setProvider] = useState<AuthProvider | null>(null)
  const [form, setForm] = useState(lastCustomer)
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const chosen = PROVIDERS.find((p) => p.id === provider)

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Digite seu nome.'
    if (!isEmail(form.email)) errs.email = form.email ? 'Confira o e-mail.' : 'Digite seu e-mail.'
    setErrors(errs)
    if (!Object.keys(errs).length) signIn({ ...form, provider: provider! })
  }

  return (
    <section className={styles.card} aria-labelledby="login-titulo">
      <h2 id="login-titulo" className="h3">Entre para ver suas reservas</h2>
      {chosen ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Field label="Nome" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="E-mail" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button type="submit" className="btn btn--blue btn--block">Entrar com {chosen.name}</button>
          <button type="button" className={`link ${styles.other}`} onClick={() => setProvider(null)}>Usar outra forma de entrar</button>
        </form>
      ) : (
        <div className={styles.providers}>
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" className="btn btn--ghost btn--block" onClick={() => setProvider(p.id)}>
              <p.icon size={20} weight={p.weight} aria-hidden="true" /> Continuar com {p.name}
            </button>
          ))}
        </div>
      )}
      <Notice>Login simulado nesta demonstração: nada é enviado ao Google ou à Apple e nenhuma senha é pedida.</Notice>
    </section>
  )
}
