// SERVER-ONLY: do not import from client components.
// Uses the service role key to bypass RLS for trusted server contexts
// (e.g., Telegram webhook).
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role',
  { auth: { persistSession: false, autoRefreshToken: false } }
)
