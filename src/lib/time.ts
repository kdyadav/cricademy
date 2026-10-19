/** Minutes since midnight for an `HH:mm` string. */
export function toMinutes(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** `16:30` -> `4:30 PM` */
export function formatTime(hhmm: string) {
  const mins = toMinutes(hhmm)
  const h = Math.floor(mins / 60)
  const m = String(mins % 60).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

export type SessionPhase = { kind: 'upcoming'; startsIn: number } | { kind: 'live'; endsIn: number } | { kind: 'done' }

export function sessionPhase(start: string, end: string, now = new Date()): SessionPhase {
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (cur < s) return { kind: 'upcoming', startsIn: s - cur }
  if (cur < e) return { kind: 'live', endsIn: e - cur }
  return { kind: 'done' }
}

/** Whole minutes from `now` until an ISO timestamp (negative once passed). */
export function minutesUntil(iso: string, now = new Date()) {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 60_000)
}

/** Short age of an ISO timestamp: `now`, `8m`, `3h`, `2d`, then `5 Oct`. */
export function timeAgo(iso: string, now = new Date()) {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** `95` -> `1h 35m` */
export function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}
