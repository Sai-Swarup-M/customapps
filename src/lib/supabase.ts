import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
  }
  return _supabase
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceKey)
  }
  return _supabaseAdmin
}

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => getSupabase()[prop as keyof SupabaseClient],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = new Proxy({} as SupabaseClient<any>, {
  get: (_, prop) => getSupabaseAdmin()[prop as keyof SupabaseClient],
})
