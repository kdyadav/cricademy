import type { Delivery, ShotZone } from '@/types'

export interface SessionSummary {
  balls: number
  runs: number
  outs: number
  dots: number
  boundaries: number
  inControl: number
  strikeRate: number
  dotPct: number
  boundaryPct: number
  controlPct: number
  zones: Record<ShotZone, number>
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)

export function summarize(deliveries: Delivery[]): SessionSummary {
  const zones: Record<ShotZone, number> = { off: 0, straight: 0, leg: 0 }
  let runs = 0, outs = 0, dots = 0, boundaries = 0, inControl = 0
  for (const d of deliveries) {
    runs += d.runs
    if (d.dismissal) outs++
    if (d.runs === 0) dots++
    if (d.runs >= 4) boundaries++
    if (d.inControl) inControl++
    if (d.zone) zones[d.zone]++
  }
  const balls = deliveries.length
  return {
    balls, runs, outs, dots, boundaries, inControl, zones,
    strikeRate: pct(runs, balls),
    dotPct: pct(dots, balls),
    boundaryPct: pct(boundaries, balls),
    controlPct: pct(inControl, balls),
  }
}

/** Overs as cricket notation, e.g. 14 balls → "2.2". */
export const formatOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
