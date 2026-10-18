import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoachRepository } from '../types'
import type { Accreditation, BatchSchedule, CoachProfile, Discipline } from '@/types'

/** Row shape of `public.coach_profiles` (see supabase/migrations). */
interface CoachProfileRow {
  id: string
  name: string
  avatar_url: string | null
  accreditation: Accreditation | null
  disciplines: Discipline[]
  facility: string
  pitch: string
  schedules: BatchSchedule[]
}

const fromRow = (r: CoachProfileRow): CoachProfile => ({
  id: r.id,
  name: r.name,
  avatarUrl: r.avatar_url ?? undefined,
  accreditation: r.accreditation,
  disciplines: r.disciplines ?? [],
  facility: r.facility,
  pitch: r.pitch,
  schedules: r.schedules ?? [],
})

const toRow = (p: CoachProfile): CoachProfileRow => ({
  id: p.id,
  name: p.name,
  avatar_url: p.avatarUrl ?? null,
  accreditation: p.accreditation,
  disciplines: p.disciplines,
  facility: p.facility,
  pitch: p.pitch,
  schedules: p.schedules,
})

export function createSupabaseCoachRepository(client: SupabaseClient): CoachRepository {
  return {
    async getByUserId(userId) {
      const { data, error } = await client.from('coach_profiles').select('*').eq('id', userId).maybeSingle<CoachProfileRow>()
      if (error) throw new Error('Could not load your profile.')
      return data ? fromRow(data) : null
    },
    async upsert(profile) {
      const { data, error } = await client.from('coach_profiles').upsert(toRow(profile)).select('*').single<CoachProfileRow>()
      if (error) throw new Error('Could not save your profile.')
      return fromRow(data)
    },
  }
}
