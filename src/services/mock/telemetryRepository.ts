import type { TelemetryRepository } from '../types'
import type { Cadet, NetSession, PlayingRole } from '@/types'
import { DISMISSAL_TYPES } from '@/data/options'
import { summarize } from '@/lib/netSession'
import { buildTelemetry, mean, rankLeaderboard, round1, type RawStats } from '@/lib/telemetry'
import { readCadets } from './cadetStore'

const STORAGE_KEY = 'cricademy:net-sessions'

const latency = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

export function readSessions(): NetSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as NetSession[]
  } catch {
    /* corrupt storage starts empty */
  }
  return []
}

/** Deterministic PRNG so each cadet always gets the same demo numbers. */
function seeded(key: string) {
  let a = [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function writeSessions(sessions: NetSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

const SKILL: Record<PlayingRole, number> = { Batter: 1, Wicketkeeper: 0.85, 'All-Rounder': 0.8, Bowler: 0.45 }

function rawStats(cadet: Cadet): RawStats {
  const rnd = seeded(cadet.id)
  const skill = SKILL[cadet.role]
  const innings = 10 + Math.floor(rnd() * 7)
  const outs = Math.max(1, Math.round(innings * (0.6 + rnd() * 0.3)))
  const runs = Math.round(skill * (220 + rnd() * 200))

  let dot = 40 + rnd() * 15
  const dotBallTrend = Array.from({ length: 8 }, () => {
    dot = Math.max(18, dot - rnd() * 2.5 + rnd() * 1.2)
    return round1(dot)
  })

  const weights = DISMISSAL_TYPES.map((_, i) => (i === 4 ? 0.3 : 1) * (0.4 + rnd()))
  const total = mean(weights) * weights.length
  const pcts = weights.map((w) => Math.round((w / total) * 100))
  pcts[0]! += 100 - pcts.reduce((s, p) => s + p, 0)

  return {
    runs,
    average: round1(runs / outs),
    strikeRate: round1(60 + skill * 30 + rnd() * 25),
    boundaryPct: round1(8 + skill * 12 + rnd() * 6),
    offSidePct: Math.round(45 + rnd() * 20),
    controlPct: round1(65 + skill * 15 + rnd() * 8),
    dotBallTrend,
    dismissals: DISMISSAL_TYPES.map((type, i) => ({ type, pct: pcts[i]! }))
      .filter((d) => d.pct > 0)
      .sort((a, b) => b.pct - a.pct),
  }
}

/** Seeded history plus every delivery the coach has logged for this cadet. */
function statsFor(cadet: Cadet, sessions: NetSession[]): RawStats {
  const base = rawStats(cadet)
  const mine = sessions.filter((s) => s.cadetId === cadet.id)
  if (!mine.length) return base
  const logged = summarize(mine.flatMap((s) => s.deliveries))
  const baseBalls = Math.round((base.runs / base.strikeRate) * 100)
  const balls = baseBalls + logged.balls
  const runs = base.runs + logged.runs
  const outs = Math.max(1, Math.round(base.runs / base.average)) + logged.outs
  return {
    ...base,
    runs,
    average: round1(runs / outs),
    strikeRate: round1((runs / balls) * 100),
    boundaryPct: round1((((base.boundaryPct / 100) * baseBalls + logged.boundaries) / balls) * 100),
    controlPct: round1((((base.controlPct / 100) * baseBalls + logged.inControl) / balls) * 100),
    dotBallTrend: [...base.dotBallTrend, ...mine.map((s) => summarize(s.deliveries).dotPct)].slice(-8),
  }
}

/** Derives telemetry from the shared cadet table; squad figures are the age-group average. */
export function createMockTelemetryRepository(): TelemetryRepository {
  return {
    async getBattingTelemetry(cadetId) {
      await latency()
      const cadets = readCadets()
      const cadet = cadets.find((c) => c.id === cadetId)
      if (!cadet) return null

      const sessions = readSessions()
      const me = statsFor(cadet, sessions)
      const cohort = cadets.filter((c) => c.ageGroup === cadet.ageGroup).map((c) => statsFor(c, sessions))
      return structuredClone(buildTelemetry(cadetId, me, cohort))
    },
    async getLeaderboard() {
      await latency()
      const sessions = readSessions()
      return rankLeaderboard(readCadets(), (c) => statsFor(c, sessions))
    },
    async listNetSessions(batchId, date) {
      await latency(200)
      return readSessions().filter((s) => s.batchId === batchId && s.date === date)
    },
    async saveNetSession(input) {
      await latency(250)
      const session: NetSession = { ...structuredClone(input), id: crypto.randomUUID(), savedAt: new Date().toISOString() }
      writeSessions([...readSessions(), session])
      return structuredClone(session)
    },
  }
}
