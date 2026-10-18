import type { AuthChangeHandler, AuthService, AuthSession, PasswordCredentials } from '../types'
import { mockCoach } from '@/data/mock'

const STORAGE_KEY = 'cricademy:session'

/** Signing in with this email loads the seeded coach profile. */
export const DEMO_EMAIL = 'vikram@apexcricket.academy'

const latency = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

function userIdFor(email: string) {
  return email === DEMO_EMAIL ? mockCoach.id : `user-${email.replace(/[^a-z0-9]+/g, '-')}`
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

/**
 * localStorage-backed auth used until Supabase Auth is connected.
 * Any email with a 6+ character password signs in; new emails get an empty profile.
 */
export function createMockAuthService(): AuthService {
  let session: AuthSession | null = readSession()
  const handlers = new Set<AuthChangeHandler>()

  function setSession(next: AuthSession | null) {
    session = next
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
    handlers.forEach((h) => h(next))
  }

  async function signIn({ email, password }: PasswordCredentials) {
    await latency()
    const normalized = email.trim().toLowerCase()
    if (password.length < 6) throw new Error('Invalid email or password')
    const next: AuthSession = {
      user: { id: userIdFor(normalized), email: normalized },
      accessToken: 'mock-access-token',
      expiresAt: null,
    }
    setSession(next)
    return next
  }

  return {
    async getSession() {
      return session
    },
    onAuthStateChange(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    signInWithPassword: signIn,
    /** Accounts are implicit in demo mode, so sign-up signs in straight away. */
    signUp: signIn,
    async sendMagicLink() {
      await latency()
      throw new Error('Email sign-in links need Supabase. Demo mode cannot send email.')
    },
    async signOut() {
      setSession(null)
    },
  }
}
