import type { SupabaseClient } from '@supabase/supabase-js'
import type { GuardianInviteService, GuardianInviteStatus } from '../types'

interface PreviewRow {
  status: GuardianInviteStatus
  cadet_name: string
  coach_name: string
  guardian_name: string | null
  expires_at: string
}

/** Backed by the `get_guardian_invite` and `accept_guardian_invite` RPCs. */
export function createSupabaseGuardianInviteService(client: SupabaseClient): GuardianInviteService {
  return {
    async preview(token) {
      const { data, error } = await client.rpc('get_guardian_invite', { p_token: token }).maybeSingle<PreviewRow>()
      if (error) throw new Error('Could not load this invite. Check your connection and try again.')
      if (!data) return null
      return {
        status: data.status,
        cadetName: data.cadet_name,
        coachName: data.coach_name,
        guardianName: data.guardian_name,
        expiresAt: data.expires_at,
      }
    },
    async accept(token) {
      const { error } = await client.rpc('accept_guardian_invite', { p_token: token })
      // Messages raised by the RPC are written for guardians.
      if (error) throw new Error(error.code?.startsWith('P0') || error.code === '28000' ? error.message : 'Could not accept the invite.')
    },
  }
}
