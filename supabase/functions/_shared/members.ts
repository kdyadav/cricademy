// Helpers shared by the member-management functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

/** Username accounts sign in with `<username>@users.cricademy.app`; the address never receives mail. */
export const USERNAME_EMAIL_DOMAIN = 'users.cricademy.app'
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,29}$/

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const usernameEmail = (username: string) => `${username}@${USERNAME_EMAIL_DOMAIN}`

export function normalizeUsername(value: unknown) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return USERNAME_PATTERN.test(username) ? username : null
}

/** Ten characters without look-alikes (0/O, 1/l/I) so it can be read out or typed from a message. */
export function temporaryPassword(length = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const limit = 256 - (256 % alphabet.length)
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length]
    }
  }
  return out
}

export type Context = { user: User; userClient: SupabaseClient; admin: SupabaseClient }

/** Returns the caller and two clients: one acting as the caller (RLS applies) and one with the service role. */
export async function getContext(req: Request): Promise<Context | null> {
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await userClient.auth.getUser()
  if (!data.user) return null
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  return { user: data.user, userClient, admin }
}

/** Runs a boolean access helper from the database as the caller. */
export async function check(userClient: SupabaseClient, fn: string, args: Record<string, string>) {
  const { data, error } = await userClient.rpc(fn, args)
  return !error && data === true
}
