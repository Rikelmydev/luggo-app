// Conexão com o banco no Supabase. Sem as variáveis de ambiente, o site roda como antes,
// com os dados só no navegador (é assim nos testes e em quem clona o projeto sem chaves).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Os testes rodam sempre com os dados locais, mesmo com as chaves no .env.local.
export const REMOTE = !!(url && anonKey) && import.meta.env.MODE !== 'test'

/** Mostra o botão "Continuar com Google" só depois de configurar o Google no Supabase. */
export const GOOGLE_LOGIN = import.meta.env.VITE_LOGIN_GOOGLE === '1'

let client: SupabaseClient | null = null

export function sb(): SupabaseClient {
  if (!REMOTE) throw new Error('Supabase não configurado')
  client ??= createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return client
}
