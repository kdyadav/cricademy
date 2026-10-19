import type { AuthChangeHandler, AuthService, AuthSession } from '../types'
import { mockCoach } from '@/data/mock'
import { loginEmail } from '@/lib/username'

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
 * Any email or username with a 6+ character password signs in; new logins get an empty profile.
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

  async function signIn(login: string, password: string) {
    await latency()
    const normalized = loginEmail(login)
    if (password.length < 6) throw new Error('Invalid username, email or password')
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
    signInWithPassword: ({ login, password }) => signIn(login, password),
    async updatePassword(password) {
      await latency()
      if (password.length < 6) throw new Error('Choose a stronger password.')
    },
    /** Accounts are implicit in demo mode, so sign-up signs in straight away. */
    signUp: ({ email, password }) => signIn(email, password),
    async sendMagicLink() {
      await latency()
      throw new Error('Email sign-in links need Supabase. Demo mode cannot send email.')
    },
    async signOut() {
      setSession(null)
    },
  }
}
