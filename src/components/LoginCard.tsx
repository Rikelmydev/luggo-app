import { useState, type ComponentType, type FormEvent } from 'react'
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
