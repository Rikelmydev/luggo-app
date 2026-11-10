// Sessão do cliente, pedida só para ver as reservas. Nesta demonstração o login é simulado:
// fica salvo no navegador e não fala com o Google nem com a Apple.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { kv } from '../services/storage'

export type AuthProvider = 'google' | 'apple' | 'email'

export interface Session {
  name: string
  email: string
  provider: AuthProvider
}

interface AuthApi {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}

const KEY = 'luggo:sessao:v1'
const AuthContext = createContext<AuthApi | null>(null)

function load(): Session | null {
  try {
    const raw = kv.get(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load)

  const signIn = useCallback((next: Session) => {
    const clean = { ...next, name: next.name.trim(), email: next.email.trim().toLowerCase() }
    kv.set(KEY, JSON.stringify(clean))
    setSession(clean)
  }, [])
  const signOut = useCallback(() => {
    kv.remove(KEY)
    setSession(null)
  }, [])

  const value = useMemo<AuthApi>(() => ({ session, signIn, signOut }), [session, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
