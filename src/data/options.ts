import type {
  Accreditation,
  AgeGroup,
  AttendanceStatus,
  Discipline,
  GuardianPermission,
  GuardianRelationship,
  LinkStatus,
  MatchFormat,
  PlayingRole,
  ShotZone,
} from '@/types'

export const AGE_GROUP_OPTIONS: AgeGroup[] = ['U-14', 'U-16', 'U-19']
export const ROLE_OPTIONS: PlayingRole[] = ['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper']
export const MATCH_FORMAT_OPTIONS: MatchFormat[] = ['T20', 'One-day', 'Two-day', 'Friendly']

export const ACCREDITATION_OPTIONS: { value: Accreditation; label: string; body: string }[] = [
  { value: 'ECB_L3', label: 'ECB Level 3', body: 'England & Wales Cricket Board' },
  { value: 'BCCI_L2', label: 'BCCI Level 2', body: 'Board of Control for Cricket in India' },
  { value: 'CA_HP', label: 'CA High Performance', body: 'Cricket Australia' },
]

export const DISCIPLINE_OPTIONS: { value: Discipline; label: string; hint: string }[] = [
  { value: 'batting', label: 'Batting', hint: 'Technique & shot selection' },
  { value: 'pace', label: 'Pace', hint: 'Run-up, action, seam' },
  { value: 'spin', label: 'Spin', hint: 'Flight, drift, variations' },
  { value: 'keeping', label: 'Keeping', hint: 'Glovework & stumpings' },
]

export const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: 'present', label: 'Present', short: 'P' },
  { value: 'late', label: 'Late', short: 'L' },
  { value: 'absent', label: 'Absent', short: 'A' },
  { value: 'injured', label: 'Injured', short: 'I' },
]

export const LATE_MINUTE_OPTIONS = [5, 10, 15, 30] as const

export const RELATIONSHIP_OPTIONS: GuardianRelationship[] = ['Mother', 'Father', 'Guardian', 'Sibling']

export const PERMISSION_OPTIONS: { value: GuardianPermission; label: string; hint: string }[] = [
  { value: 'fee_payer', label: 'Fee payer', hint: 'Receives invoices and payment reminders' },
  { value: 'attendance_signoff', label: 'Attendance sign-off', hint: 'Can excuse absences and confirm sessions' },
  { value: 'view_only', label: 'View only', hint: 'Sees progress reports, no actions' },
]

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  linked: 'Linked',
  pending: 'Invite pending',
  unlinked: 'No guardian',
}

export const DISMISSAL_TYPES = ['Caught in field', 'Bowled', 'Caught behind', 'LBW', 'Run out'] as const

export const SHOT_ZONE_OPTIONS: { value: ShotZone; label: string }[] = [
  { value: 'off', label: 'Off side' },
  { value: 'straight', label: 'Straight' },
  { value: 'leg', label: 'Leg side' },
]

export const DRILL_FOCUS_OPTIONS = [
  'General nets',
  'Front-foot drives',
  'Short-ball defence',
  'Yorker accuracy',
  'Run-up rhythm',
  'Spin variations',
  'Keeping footwork',
  'Fielding & throws',
  'Match simulation',
  'Rehab & mobility',
] as const
