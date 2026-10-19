import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcademyMember, AcademyRole, AddMemberResult, Membership, MembershipService } from '../types'

/** Calls an Edge Function and surfaces its `{ error }` message when it fails. */
export async function invoke<T>(client: SupabaseClient, name: string, body: object, fallback: string): Promise<T> {
  const { data, error } = await client.functions.invoke<T>(name, { body })
  if (!error && data) return data
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    const payload = (await context.json().catch(() => null)) as { error?: string } | null
    if (payload?.error) throw new Error(payload.error)
  }
  throw new Error(fallback)
}

/** Row shape of `public.academy_members` joined with the academy name. */
interface MembershipRow {
  academy_id: string
  role: AcademyRole
  status: Membership['status']
  academies: { name: string } | null
}

export function createSupabaseMembershipService(client: SupabaseClient): MembershipService {
  return {
    async getProfile(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('id, username, display_name, must_change_password')
        .eq('id', userId)
        .maybeSingle<{ id: string; username: string | null; display_name: string; must_change_password: boolean }>()
      if (error) throw new Error('Could not load your account.')
      if (!data) return null
      return { id: data.id, username: data.username, displayName: data.display_name, mustChangePassword: data.must_change_password }
    },
    async list(userId) {
      const { data, error } = await client
        .from('academy_members')
        .select('academy_id, role, status, academies(name)')
        .eq('user_id', userId)
        .order('created_at')
        .returns<MembershipRow[]>()
      if (error) throw new Error('Could not load your academies.')
      return data.map((r) => ({ academyId: r.academy_id, academyName: r.academies?.name ?? 'Academy', role: r.role, status: r.status }))
    },
    async respond(academyId, accept) {
      const { error } = await client.rpc('respond_to_membership', { p_academy_id: academyId, p_accept: accept })
      if (error?.code === 'P0002') throw new Error('This invitation is no longer available.')
      if (error) throw new Error(accept ? 'Could not accept the invitation.' : 'Could not decline the invitation.')
    },
    async renameAcademy(academyId, name) {
      const { data, error } = await client.from('academies').update({ name }).eq('id', academyId).select('id')
      if (error || !data?.length) throw new Error('Could not rename the academy.')
    },
    async listMembers(academyId) {
      const { data: rows, error } = await client
        .from('academy_members')
        .select('user_id, role, status')
        .eq('academy_id', academyId)
        .order('created_at')
        .returns<{ user_id: string; role: AcademyRole; status: Membership['status'] }[]>()
      if (error) throw new Error('Could not load members.')
      if (!rows.length) return []
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, username, display_name')
        .in(
          'id',
          rows.map((r) => r.user_id),
        )
        .returns<{ id: string; username: string | null; display_name: string }[]>()
      if (profileError) throw new Error('Could not load members.')
      const byId = new Map(profiles.map((p) => [p.id, p]))
      return rows.map<AcademyMember>((r) => ({
        userId: r.user_id,
        username: byId.get(r.user_id)?.username ?? null,
        displayName: byId.get(r.user_id)?.display_name ?? '',
        role: r.role,
        status: r.status,
      }))
    },
    addMember(input) {
      return invoke<AddMemberResult>(client, 'create-member', input, 'Could not add the member.')
    },
    async removeMember(academyId, userId) {
      const { error } = await client.from('academy_members').delete().eq('academy_id', academyId).eq('user_id', userId)
      if (error) throw new Error('Could not remove the member.')
    },
    async resetPassword(academyId, userId) {
      const data = await invoke<{ temporaryPassword: string }>(
        client,
        'reset-member-password',
        { academyId, userId },
        'Could not reset the password.',
      )
      return data.temporaryPassword
    },
    async listBatchCoaches(academyId) {
      const { data, error } = await client
        .from('batch_coaches')
        .select('batch_id, coach_id, net_batches!inner(academy_id)')
        .eq('net_batches.academy_id', academyId)
        .returns<{ batch_id: string; coach_id: string }[]>()
      if (error) throw new Error('Could not load batch coaches.')
      return data.map((r) => ({ batchId: r.batch_id, coachId: r.coach_id }))
    },
    async setBatchCoach(batchId, coachId, assigned) {
      const { error } = assigned
        ? await client.from('batch_coaches').upsert({ batch_id: batchId, coach_id: coachId }, { ignoreDuplicates: true })
        : await client.from('batch_coaches').delete().eq('batch_id', batchId).eq('coach_id', coachId)
      if (error) throw new Error(assigned ? 'Could not assign the coach.' : 'Could not unassign the coach.')
    },
  }
}
