import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ValidationError } from '../../domain/errors'

let supabaseClient: SupabaseClient | undefined

function getRequiredEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name]
  if (!value) {
    throw new ValidationError(`${name} is required for Supabase knowledge retrieval`)
  }

  return value
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return supabaseClient
}
