import type { BattingTelemetry, BenchmarkMetric, Cadet, LeaderboardEntry, NetSession } from '@/types'
import { summarize } from './netSession'

export interface RawStats {
  runs: number
  average: number
  strikeRate: number
  boundaryPct: number
  offSidePct: number
  controlPct: number
  dotBallTrend: number[]
  dismissals: { type: string; pct: number }[]
}

export const round1 = (n: number) => Math.round(n * 10) / 10
export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1)

const bySavedAt = (a: NetSession, b: NetSession) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt)

/** Figures from logged deliveries only; `null` when the sessions contain no balls. */
export function statsFromSessions(sessions: NetSession[]): RawStats | null {
  const ordered = [...sessions].sort(bySavedAt)
  const balls = ordered.flatMap((s) => s.deliveries)
  const s = summarize(balls)
  if (!s.balls) return null

  const sides = s.zones.off + s.zones.leg
  const counts = new Map<string, number>()
  for (const d of balls) if (d.dismissal) counts.set(d.dismissal, (counts.get(d.dismissal) ?? 0) + 1)

  return {
    runs: s.runs,
    average: round1(s.runs / Math.max(1, s.outs)),
    strikeRate: s.strikeRate,
    boundaryPct: s.boundaryPct,
    offSidePct: sides ? Math.round((s.zones.off / sides) * 100) : 50,
    controlPct: s.controlPct,
    dotBallTrend: ordered
      .filter((x) => x.deliveries.length)
      .map((x) => summarize(x.deliveries).dotPct)
      .slice(-8),
    dismissals: [...counts]
      .map(([type, n]) => ({ type, pct: Math.round((n / s.outs) * 100) }))
      .sort((a, b) => b.pct - a.pct),
  }
}

const recentDot = (s: RawStats) => round1(mean(s.dotBallTrend.slice(-3)))

function benchmark(
  label: string,
  player: number,
  squad: number,
  unit: BenchmarkMetric['unit'],
  captions: [ahead: string, behind: string],
  lowerIsBetter = false,
): BenchmarkMetric {
  const ahead = lowerIsBetter ? player <= squad : player >= squad
  return { label, player, squad: round1(squad), unit, lowerIsBetter, caption: ahead ? captions[0] : captions[1] }
}

/** `cohort` is every cadet in the same age group with figures (including `me`). */
export function buildTelemetry(cadetId: string, me: RawStats, cohort: RawStats[]): BattingTelemetry {
  const squadRuns = mean(cohort.map((s) => s.runs))
  return {
    cadetId,
    totalRuns: me.runs,
    runsCohortDelta: squadRuns ? Math.round(((me.runs - squadRuns) / squadRuns) * 100) : 0,
    average: me.average,
    strikeRate: me.strikeRate,
    boundaryPct: me.boundaryPct,
    offSidePct: me.offSidePct,
    legSidePct: 100 - me.offSidePct,
    dotBallTrend: me.dotBallTrend,
    dismissals: me.dismissals,
    benchmarks: [
      benchmark('Strike rate', me.strikeRate, mean(cohort.map((s) => s.strikeRate)), '', [
        'Keeps the scoreboard moving',
        'Work on rotating strike',
      ]),
      benchmark('Boundary %', me.boundaryPct, mean(cohort.map((s) => s.boundaryPct)), '%', [
        'Finds the rope regularly',
        'Build power through the line',
      ]),
      benchmark('Dot-ball %', recentDot(me), mean(cohort.map(recentDot)), '%', [
        'Rarely gets tied down',
        'Too many dots — look for singles',
      ], true),
      benchmark('In-control %', me.controlPct, mean(cohort.map((s) => s.controlPct)), '%', [
        'Plays late and under the eyes',
        'Reduce false shots outside off',
      ]),
    ],
  }
}

/** Ranks every cadet by runs within their division (ties broken by strike rate); cadets without figures score 0. */
export function rankLeaderboard(cadets: Cadet[], statsOf: (c: Cadet) => RawStats | null): LeaderboardEntry[] {
  const entries = cadets.map((c) => {
    const s = statsOf(c)
    return { cadetId: c.id, rank: 0, runs: s?.runs ?? 0, strikeRate: s?.strikeRate ?? 0, division: c.ageGroup }
  })
  const ranked: LeaderboardEntry[] = []
  for (const division of new Set(entries.map((e) => e.division))) {
    entries
      .filter((e) => e.division === division)
      .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)
      .forEach((e, i) => ranked.push({ ...e, rank: i + 1 }))
  }
  return ranked
}
