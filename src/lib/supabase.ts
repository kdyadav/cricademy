import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** `null` when the env vars are missing, in which case the app falls back to mock services. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
