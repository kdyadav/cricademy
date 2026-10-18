import type { SupabaseClient } from '@supabase/supabase-js'
import type { TelemetryRepository } from '../types'
import type { Delivery, NetSession } from '@/types'
import { buildTelemetry, rankLeaderboard, statsFromSessions, type RawStats } from '@/lib/telemetry'
import { cadetFromRow, type CadetRow } from './cadetRepository'

/** Row shape of `public.net_sessions`. */
interface SessionRow {
  id: string
  cadet_id: string
  batch_id: string | null
  date: string
  deliveries: Delivery[]
  saved_at: string
}

const sessionFromRow = (r: SessionRow): NetSession => ({
  id: r.id,
  cadetId: r.cadet_id,
  batchId: r.batch_id ?? '',
  date: r.date,
  deliveries: r.deliveries ?? [],
  savedAt: r.saved_at,
})

const SESSION_COLUMNS = 'id, cadet_id, batch_id, date, deliveries, saved_at'

/** Figures come only from deliveries logged in the Nets tab; aggregation happens on the client. */
export function createSupabaseTelemetryRepository(client: SupabaseClient): TelemetryRepository {
  async function loadSquad(coachId: string) {
    const [cadets, sessions] = await Promise.all([
      client.from('cadets').select('*').eq('coach_id', coachId).returns<CadetRow[]>(),
      client.from('net_sessions').select(SESSION_COLUMNS).eq('coach_id', coachId).returns<SessionRow[]>(),
    ])
    if (cadets.error || sessions.error) throw new Error('Could not load player stats.')
    const byCadet = new Map<string, NetSession[]>()
    for (const s of sessions.data.map(sessionFromRow)) byCadet.set(s.cadetId, [...(byCadet.get(s.cadetId) ?? []), s])
    const stats = new Map<string, RawStats | null>()
    for (const c of cadets.data) stats.set(c.id, statsFromSessions(byCadet.get(c.id) ?? []))
    return { cadets: cadets.data.map(cadetFromRow), stats }
  }

  async function currentCoachId() {
    const { data } = await client.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('You are signed out.')
    return id
  }

  return {
    async getBattingTelemetry(cadetId) {
      const { cadets, stats } = await loadSquad(await currentCoachId())
      const cadet = cadets.find((c) => c.id === cadetId)
      const me = stats.get(cadetId)
      if (!cadet || !me) return null
      const cohort = cadets
        .filter((c) => c.ageGroup === cadet.ageGroup)
        .map((c) => stats.get(c.id))
        .filter((s): s is RawStats => !!s)
      return buildTelemetry(cadetId, me, cohort)
    },
    async getLeaderboard(coachId) {
      const { cadets, stats } = await loadSquad(coachId)
      return rankLeaderboard(cadets, (c) => stats.get(c.id) ?? null)
    },
    async listNetSessions(batchId, date) {
      const { data, error } = await client
        .from('net_sessions')
        .select(SESSION_COLUMNS)
        .eq('batch_id', batchId)
        .eq('date', date)
        .order('saved_at')
        .returns<SessionRow[]>()
      if (error) throw new Error('Could not load net sessions.')
      return data.map(sessionFromRow)
    },
    async saveNetSession(input) {
      const { data, error } = await client
        .from('net_sessions')
        .insert({ cadet_id: input.cadetId, batch_id: input.batchId || null, date: input.date, deliveries: input.deliveries })
        .select(SESSION_COLUMNS)
        .single<SessionRow>()
      if (error) throw new Error('Could not save the session.')
      return sessionFromRow(data)
    },
  }
}
