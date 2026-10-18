import type { SupabaseClient } from '@supabase/supabase-js'
import type { CadetInput, CadetRepository, GuardianInviteResult, InviteDelivery } from '../types'
import type { AgeGroup, Cadet, Guardian, LinkStatus, PlayingRole } from '@/types'

const INVITE_TTL_HOURS = 48

const DELIVERY_REASONS: Record<string, string> = {
  not_a_phone: 'Email invites are not sent automatically yet. Share the link below.',
  not_configured: 'WhatsApp sending is not set up yet. Share the link below.',
}

export const inviteLink = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}invite/${token}`

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
  fee_due: i.feeDue,
})

export function createSupabaseCadetRepository(client: SupabaseClient): CadetRepository {
  async function patch(cadetId: string, values: Partial<Omit<CadetRow, 'id'>>, failure: string) {
    const { data, error } = await client.from('cadets').update(values).eq('id', cadetId).select('*').single<CadetRow>()
    if (error) throw new Error(failure)
    return cadetFromRow(data)
  }

  /** Mints a single-use token, then asks the Edge Function to deliver it over WhatsApp. */
  async function issueInvite(cadetId: string, failure: string): Promise<GuardianInviteResult> {
    const { data, error } = await client
      .rpc('create_guardian_invite', { p_cadet_id: cadetId, p_ttl_hours: INVITE_TTL_HOURS })
      .single<{ invite_id: string; token: string; expires_at: string }>()
    if (error) throw new Error(failure)
    const link = inviteLink(data.token)

    let delivery: InviteDelivery
    const { data: sent, error: sendError } = await client.functions.invoke<{ status: string; reason?: string }>(
      'send-guardian-invite',
      { body: { inviteId: data.invite_id, token: data.token } },
    )
    if (sent?.status === 'sent') delivery = { status: 'sent', link }
    else if (sendError || !sent) delivery = { status: 'manual', link, reason: 'Could not reach the WhatsApp service. Share the link below.' }
    else delivery = { status: 'manual', link, reason: DELIVERY_REASONS[sent.reason ?? ''] ?? `WhatsApp could not deliver it (${sent.reason ?? 'unknown error'}). Share the link below.` }

    const { data: row, error: readError } = await client.from('cadets').select('*').eq('id', cadetId).single<CadetRow>()
    if (readError) throw new Error(failure)
    return { cadet: cadetFromRow(row), delivery }
  }

  return {
    async list(coachId) {
      const { data, error } = await client.from('cadets').select('*').eq('coach_id', coachId).order('name').returns<CadetRow[]>()
      if (error) throw new Error('Could not load the squad.')
      return data.map(cadetFromRow)
    },
    async create(coachId, input) {
      const { data, error } = await client
        .from('cadets')
        .insert({ ...inputToRow(input), coach_id: coachId })
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
    async sendGuardianInvite(cadetId, guardian) {
      await patch(cadetId, { link_status: 'pending', guardian: { ...guardian, verified: false } }, 'Could not send the invite.')
      return issueInvite(cadetId, 'Could not send the invite.')
    },
    async resendGuardianInvite(cadetId) {
      const { data, error } = await client.from('cadets').select('link_status').eq('id', cadetId).maybeSingle<Pick<CadetRow, 'link_status'>>()
      if (error) throw new Error('Could not resend the invite.')
      if (data?.link_status !== 'pending') throw new Error('There is no pending invite to resend.')
      return issueInvite(cadetId, 'Could not resend the invite.')
    },
    unlinkGuardian: (cadetId) =>
      patch(
        cadetId,
        { link_status: 'unlinked', guardian: null, invite_expires_at: null, guardian_user_id: null },
        'Could not remove the guardian.',
      ),
  }
}
