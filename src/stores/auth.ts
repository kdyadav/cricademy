import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService, type AuthSession, type PasswordCredentials, type SignInCredentials } from '@/services'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null)
  const ready = ref(false)
  let initPromise: Promise<void> | null = null

  const user = computed(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => session.value !== null)

  /** Idempotent: resolves the current session once and subscribes to changes. */
  function init() {
    initPromise ??= (async () => {
      session.value = await authService.getSession()
      authService.onAuthStateChange((next) => {
        session.value = next
      })
      ready.value = true
    })()
    return initPromise
  }

  async function signIn(credentials: SignInCredentials) {
    session.value = await authService.signInWithPassword(credentials)
  }

  const updatePassword = (password: string) => authService.updatePassword(password)

  /** Returns `true` when the account is active now, `false` when it awaits email confirmation. */
  async function signUp(credentials: PasswordCredentials) {
    const next = await authService.signUp(credentials)
    if (next) session.value = next
    return next !== null
  }

  /** The session arrives through `onAuthStateChange` once the emailed link is opened. */
  const sendMagicLink = (email: string, redirectTo: string) => authService.sendMagicLink(email, redirectTo)

  async function signOut() {
    await authService.signOut()
    session.value = null
  }

  return { session, ready, user, isAuthenticated, init, signIn, updatePassword, signUp, sendMagicLink, signOut }
})
