import type { GuardianInviteService } from '../types'

/** Demo mode never issues invite links, so every token is unknown. */
export function createMockGuardianInviteService(): GuardianInviteService {
  return {
    async preview() {
      return null
    },
    async accept() {
      throw new Error('Invites can only be accepted when the app is connected to Supabase.')
    },
  }
}
