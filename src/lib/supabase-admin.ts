// SERVER-ONLY: do not import from client components.
// Uses the service role key to bypass RLS for trusted server contexts
// (e.g., Telegram webhook).
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Fail fast at module load — missing keys in production = silent data corruption risk
if (typeof window === 'undefined' && (!url || url === 'https://placeholder.supabase.co')) {
  console.error('[supabase-admin] NEXT_PUBLIC_SUPABASE_URL is not set')
}
if (typeof window === 'undefined' && (!key || key === 'placeholder-service-role')) {
  console.error('[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set')
}

export const supabaseAdmin = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-service-role',
  { auth: { persistSession: false, autoRefreshToken: false } }
)
