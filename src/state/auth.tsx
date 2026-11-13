// Conta do cliente (e da equipe). Com Supabase, é login de verdade com e-mail e senha
// (ou Google, se configurado). Sem Supabase, continua a entrada simulada da demonstração.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { loadMine } from '../services/remote'
import { kv } from '../services/storage'
import { REMOTE, sb } from '../services/supabase'

export type AuthProvider = 'google' | 'apple' | 'email'

export interface Session {
  name: string
  email: string
  provider: AuthProvider
}

interface AuthApi {
  session: Session | null
  /** A sessão salva no navegador já foi lida? */
  ready: boolean
  /** Entrada simulada (sem Supabase). */
  signIn: (session: Session) => void
  /** Devolvem a mensagem de erro, ou null quando deu certo. */
  signInWithPassword: (email: string, password: string) => Promise<string | null>
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null; confirm: boolean }>
  signInWithGoogle: (path: string) => Promise<string | null>
  signOut: () => void
}

const KEY = 'luggo:sessao:v1'
const AuthContext = createContext<AuthApi | null>(null)

function loadDemo(): Session | null {
  try {
    const raw = kv.get(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

const fromUser = (u: User): Session => ({
  name: (u.user_metadata?.name as string | undefined) || (u.user_metadata?.full_name as string | undefined) || u.email!.split('@')[0],
  email: u.email!,
  provider: u.app_metadata?.provider === 'google' ? 'google' : 'email',
})

/** Mensagens do Supabase Auth em português. */
function authError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered')) return 'Já existe uma conta com esse e-mail. Entre com a sua senha.'
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Confira o e-mail.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'
  if (m.includes('provider is not enabled')) return 'O login com Google ainda não foi ativado.'
  return 'Não deu para entrar agora. Tente de novo em instantes.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(REMOTE ? null : loadDemo)
  const [ready, setReady] = useState(!REMOTE)

  useEffect(() => {
    if (!REMOTE) return
    sb()
      .auth.getSession()
      .then(({ data }) => {
        setSession(data.session ? fromUser(data.session.user) : null)
        setReady(true)
      })
    // Entrou ou saiu: as reservas da conta aparecem (ou somem) na hora.
    const { data } = sb().auth.onAuthStateChange((_event, s) => {
      setSession(s ? fromUser(s.user) : null)
      setReady(true)
      loadMine().catch(() => {})
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback((next: Session) => {
    const clean = { ...next, name: next.name.trim(), email: next.email.trim().toLowerCase() }
    kv.set(KEY, JSON.stringify(clean))
    setSession(clean)
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    return error ? authError(error.message) : null
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await sb().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}minhas-reservas` },
    })
    if (error) return { error: authError(error.message), confirm: false }
    // Com a confirmação de e-mail ligada no Supabase, a conta só entra depois do link.
    return { error: null, confirm: !data.session }
  }, [])

  const signInWithGoogle = useCallback(async (path: string) => {
    const { error } = await sb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}` },
    })
    return error ? authError(error.message) : null
  }, [])

  const signOut = useCallback(() => {
    if (REMOTE) {
      sb().auth.signOut()
      return
    }
    kv.remove(KEY)
    setSession(null)
  }, [])

  const value = useMemo<AuthApi>(
    () => ({ session, ready, signIn, signInWithPassword, signUp, signInWithGoogle, signOut }),
    [session, ready, signIn, signInWithPassword, signUp, signInWithGoogle, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
