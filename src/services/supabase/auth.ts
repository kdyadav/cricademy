import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js'
import type { AuthService, AuthSession } from '../types'

const FRIENDLY_ERRORS: Record<string, string> = {
  invalid_credentials: 'Invalid email or password',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link we sent.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Choose a stronger password.',
  signup_disabled: 'New sign-ups are currently disabled.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
}

function friendly(error: AuthError | null, fallback: string) {
  return new Error((error?.code && FRIENDLY_ERRORS[error.code]) || error?.message || fallback)
}

function toSession(s: Session | null): AuthSession | null {
  if (!s) return null
  return {
    user: { id: s.user.id, email: s.user.email ?? null },
    accessToken: s.access_token,
    expiresAt: s.expires_at ?? null,
  }
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession()
      if (error) return null
      return toSession(data.session)
    },
    onAuthStateChange(handler) {
      const { data } = client.auth.onAuthStateChange((_event, session) => handler(toSession(session)))
      return () => data.subscription.unsubscribe()
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error || !data.session) throw friendly(error, 'Invalid email or password')
      return toSession(data.session)!
    },
    async signUp({ email, password }) {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      })
      if (error) throw friendly(error, 'Could not create your account. Please try again.')
      // With email confirmation on, an existing address returns a user with no identities instead of an error.
      if (!data.session && data.user?.identities?.length === 0) throw new Error(FRIENDLY_ERRORS.user_already_exists)
      return toSession(data.session)
    },
    async sendMagicLink(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      })
      if (error) throw friendly(error, 'Could not send the sign-in link. Please try again.')
    },
    async signOut() {
      await client.auth.signOut()
    },
  }
}
