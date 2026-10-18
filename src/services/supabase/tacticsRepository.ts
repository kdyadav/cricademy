import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchPlanInput, TacticsRepository } from '../types'
import type { AgeGroup, MatchFormat, MatchPlan } from '@/types'

/** Row shape of `public.match_plans`. */
interface PlanRow {
  id: string
  opponent: string
  match_date: string
  venue: string
  format: MatchFormat
  age_group: AgeGroup
  xi: string[]
  captain_id: string | null
  keeper_id: string | null
  notes: string
  updated_at: string
}

const fromRow = (r: PlanRow): MatchPlan => ({
  id: r.id,
  opponent: r.opponent,
  date: r.match_date,
  venue: r.venue,
  format: r.format,
  ageGroup: r.age_group,
  xi: r.xi ?? [],
  captainId: r.captain_id,
  keeperId: r.keeper_id,
  notes: r.notes,
  updatedAt: r.updated_at,
})

const toRow = (p: MatchPlanInput) => ({
  opponent: p.opponent,
  match_date: p.date,
  venue: p.venue,
  format: p.format,
  age_group: p.ageGroup,
  xi: p.xi,
  captain_id: p.captainId,
  keeper_id: p.keeperId,
  notes: p.notes,
})

export function createSupabaseTacticsRepository(client: SupabaseClient): TacticsRepository {
  return {
    async list(coachId) {
      const { data, error } = await client
        .from('match_plans')
        .select('*')
        .eq('coach_id', coachId)
        .order('match_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .returns<PlanRow[]>()
      if (error) throw new Error('Could not load match plans.')
      return data.map(fromRow)
    },
    async create(coachId, input) {
      const { data, error } = await client
        .from('match_plans')
        .insert({ ...toRow(input), coach_id: coachId })
        .select('*')
        .single<PlanRow>()
      if (error) throw new Error('Could not save the match plan.')
      return fromRow(data)
    },
    async update(planId, input) {
      const { data, error } = await client.from('match_plans').update(toRow(input)).eq('id', planId).select('*').single<PlanRow>()
      if (error) throw new Error('Could not save the match plan.')
      return fromRow(data)
    },
    async remove(planId) {
      const { error } = await client.from('match_plans').delete().eq('id', planId)
      if (error) throw new Error('Could not delete the match plan.')
    },
  }
}
