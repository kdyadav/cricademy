import type { SupabaseClient } from '@supabase/supabase-js'
import type { AddMemberResult, CadetInput, CadetRepository } from '../types'
import type { AgeGroup, Cadet, Guardian, LinkStatus, PlayingRole } from '@/types'
import { invoke } from './membershipService'

/** Row shape of `public.cadets` (see supabase/migrations). */
export interface CadetRow {
  id: string
  batch_id: string | null
  name: string
  jersey: number
  avatar_url: string | null
  age_group: AgeGroup
  role: PlayingRole
  batting_hand: 'Right' | 'Left'
  bowling_style: string | null
  link_status: LinkStatus
  guardian: Guardian | null
  invite_expires_at: string | null
  guardian_user_id?: string | null
  fee_due: number | string
}

export const cadetFromRow = (r: CadetRow): Cadet => ({
  id: r.id,
  name: r.name,
  jersey: r.jersey,
  avatarUrl: r.avatar_url ?? undefined,
  ageGroup: r.age_group,
  role: r.role,
  battingHand: r.batting_hand,
  bowlingStyle: r.bowling_style ?? undefined,
  batchId: r.batch_id ?? '',
  linkStatus: r.link_status,
  guardian: r.guardian ?? undefined,
  guardianUserId: r.guardian_user_id ?? undefined,
  inviteExpiresAt: r.invite_expires_at ?? undefined,
  feeDue: Number(r.fee_due),
})

const inputToRow = (i: CadetInput) => ({
  name: i.name,
  jersey: i.jersey,
  age_group: i.ageGroup,
  role: i.role,
  batting_hand: i.battingHand,
  bowling_style: i.bowlingStyle?.trim() || null,
  batch_id: i.batchId || null,
})

export function createSupabaseCadetRepository(client: SupabaseClient): CadetRepository {
  async function patch(cadetId: string, values: Partial<Omit<CadetRow, 'id'>>, failure: string) {
    const { data, error } = await client.from('cadets').update(values).eq('id', cadetId).select('*').single<CadetRow>()
    if (error) throw new Error(failure)
    return cadetFromRow(data)
  }

  /** Drops the cadet's link to a guardian account, if any. */
  async function dropGuardianLink(cadetId: string, guardianId: string | null | undefined, failure: string) {
    if (!guardianId) return
    const { error } = await client.from('cadet_guardians').delete().eq('cadet_id', cadetId).eq('guardian_id', guardianId)
    if (error) throw new Error(failure)
  }

  return {
    async list(academyId) {
      const { data, error } = await client.from('cadets').select('*').eq('academy_id', academyId).order('name').returns<CadetRow[]>()
      if (error) throw new Error('Could not load the squad.')
      return data.map(cadetFromRow)
    },
    async create(academyId, input) {
      const { data, error } = await client
        .from('cadets')
        .insert({ ...inputToRow(input), academy_id: academyId })
        .select('*')
        .single<CadetRow>()
      if (error) throw new Error('Could not add the cadet.')
      return cadetFromRow(data)
    },
    update: (cadetId, input) => patch(cadetId, inputToRow(input), 'Could not save the cadet.'),
    async remove(cadetId) {
      const { error } = await client.from('cadets').delete().eq('id', cadetId)
      if (error) throw new Error('Could not remove the cadet.')
    },
    async addGuardian(academyId, cadetId, guardian) {
      const failure = 'Could not add the guardian.'
      const { data: before, error } = await client
        .from('cadets')
        .select('guardian_user_id')
        .eq('id', cadetId)
        .single<Pick<CadetRow, 'guardian_user_id'>>()
      if (error) throw new Error(failure)
      // Sets `guardian_user_id` and `link_status` on the cadet.
      const member = await invoke<AddMemberResult>(
        client,
        'create-member',
        { academyId, role: 'guardian', username: guardian.username, displayName: guardian.name, cadetId, relationship: guardian.relationship },
        failure,
      )
      if (before.guardian_user_id !== member.userId) await dropGuardianLink(cadetId, before.guardian_user_id, failure)
      const cadet = await patch(cadetId, { guardian: { ...guardian, verified: member.status === 'active' } }, failure)
      return { cadet, member }
    },
    async unlinkGuardian(cadetId) {
      const failure = 'Could not remove the guardian.'
      const { data, error } = await client
        .from('cadets')
        .select('guardian_user_id')
        .eq('id', cadetId)
        .single<Pick<CadetRow, 'guardian_user_id'>>()
      if (error) throw new Error(failure)
      await dropGuardianLink(cadetId, data.guardian_user_id, failure)
      return patch(cadetId, { link_status: 'unlinked', guardian: null, invite_expires_at: null, guardian_user_id: null }, failure)
    },
  }
}
