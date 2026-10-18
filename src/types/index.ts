export type Accreditation = 'ECB_L3' | 'BCCI_L2' | 'CA_HP'
export type Discipline = 'batting' | 'pace' | 'spin' | 'keeping'
export type AgeGroup = 'U-14' | 'U-16' | 'U-19'
export type PlayingRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper'

export interface BatchSchedule {
  id: string
  label: string
  start: string
  end: string
}

export interface CoachProfile {
  id: string
  name: string
  avatarUrl?: string
  accreditation: Accreditation | null
  disciplines: Discipline[]
  facility: string
  pitch: string
  schedules: BatchSchedule[]
}

export type GuardianRelationship = 'Mother' | 'Father' | 'Guardian' | 'Sibling'
export type GuardianPermission = 'fee_payer' | 'attendance_signoff' | 'view_only'

export interface Guardian {
  name: string
  contact: string
  relationship: GuardianRelationship
  permissions: GuardianPermission[]
  verified: boolean
}

export type LinkStatus = 'linked' | 'pending' | 'unlinked'

export interface Cadet {
  id: string
  name: string
  jersey: number
  avatarUrl?: string
  ageGroup: AgeGroup
  role: PlayingRole
  battingHand: 'Right' | 'Left'
  bowlingStyle?: string
  batchId: string
  linkStatus: LinkStatus
  guardian?: Guardian
  /** ISO timestamp of when a pending invite expires */
  inviteExpiresAt?: string
  /** Sum of the cadet's open fee dues */
  feeDue: number
}

export type FeeStatus = 'due' | 'paid' | 'waived'
export type PaymentMethod = 'upi' | 'cash' | 'other'

export interface FeeDue {
  id: string
  cadetId: string
  title: string
  amount: number
  /** `YYYY-MM-DD` */
  dueDate: string
  status: FeeStatus
  paidAt?: string
  method?: PaymentMethod
  /** UTR or receipt number recorded by the coach */
  reference?: string
  /** UTR submitted by the payer on the pay page, awaiting the coach's confirmation */
  reportedReference?: string
  reportedAt?: string
  remindedAt?: string
}

/** Where parents pay: the academy's UPI ID (PhonePe or any UPI app) and the name shown to them. */
export interface FeeSettings {
  upiId: string
  payeeName: string
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'injured'

export interface AttendanceRecord {
  cadetId: string
  status: AttendanceStatus
  lateMinutes?: number
  drillFocus: string
  note?: string
  excusedByParent?: boolean
}

export interface NetBatch {
  id: string
  label: string
  ageGroup: AgeGroup
  focus: string
  start: string
  end: string
  pitch: string
}

export interface BenchmarkMetric {
  label: string
  player: number
  squad: number
  unit: '%' | ''
  /** true when a lower value is better (e.g. dot-ball %) */
  lowerIsBetter?: boolean
  caption: string
}

export interface BattingTelemetry {
  cadetId: string
  totalRuns: number
  runsCohortDelta: number
  average: number
  strikeRate: number
  boundaryPct: number
  offSidePct: number
  legSidePct: number
  dotBallTrend: number[]
  benchmarks: BenchmarkMetric[]
  dismissals: { type: string; pct: number }[]
}

export type ShotZone = 'off' | 'straight' | 'leg'

/** One ball faced in the nets. Dismissals always score 0. */
export interface Delivery {
  runs: 0 | 1 | 2 | 3 | 4 | 6
  zone: ShotZone | null
  inControl: boolean
  dismissal?: string
}

/** A batter's logged stint in a net batch on one calendar day (`date` is `YYYY-MM-DD`). */
export interface NetSession {
  id: string
  cadetId: string
  batchId: string
  date: string
  deliveries: Delivery[]
  savedAt: string
}

export interface LeaderboardEntry {
  cadetId: string
  rank: number
  runs: number
  strikeRate: number
  division: AgeGroup
}

export type MatchFormat = 'T20' | 'One-day' | 'Two-day' | 'Friendly'

/** A fixture with its selected playing XI; `xi` holds cadet ids in batting order. */
export interface MatchPlan {
  id: string
  opponent: string
  date: string
  venue: string
  format: MatchFormat
  ageGroup: AgeGroup
  xi: string[]
  captainId: string | null
  keeperId: string | null
  notes: string
  updatedAt: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  tone: 'info' | 'alert' | 'success'
}
