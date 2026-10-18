import type {
  AttendanceRecord,
  BattingTelemetry,
  Cadet,
  CoachProfile,
  Guardian,
  LeaderboardEntry,
  MatchPlan,
  NetBatch,
  NetSession,
} from '@/types'

/** Mirrors the subset of Supabase's `User` the app relies on. */
export interface AuthUser {
  id: string
  email: string | null
}

/** Mirrors the subset of Supabase's `Session` the app relies on. */
export interface AuthSession {
  user: AuthUser
  accessToken: string
  expiresAt: number | null
}

export type AuthChangeHandler = (session: AuthSession | null) => void

export interface PasswordCredentials {
  email: string
  password: string
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>
  /** Returns an unsubscribe function. */
  onAuthStateChange(handler: AuthChangeHandler): () => void
  /** Rejects with an Error whose message is safe to show to the user. */
  signInWithPassword(credentials: PasswordCredentials): Promise<AuthSession>
  /**
   * Resolves with the new session, or `null` when the account must confirm its email first.
   * Rejects with an Error whose message is safe to show to the user.
   */
  signUp(credentials: PasswordCredentials): Promise<AuthSession | null>
  /** Emails a one-tap sign-in link that returns to `redirectTo`; creates the account if needed. */
  sendMagicLink(email: string, redirectTo: string): Promise<void>
  signOut(): Promise<void>
}

/** Coach profiles are keyed by the auth user id (one row per user). */
export interface CoachRepository {
  getByUserId(userId: string): Promise<CoachProfile | null>
  upsert(profile: CoachProfile): Promise<CoachProfile>
}

/** Mirrors a Supabase Storage bucket for user avatars. */
export interface StorageService {
  /** Uploads (or replaces) the user's avatar and returns a URL usable in `<img src>`. */
  uploadAvatar(userId: string, file: File): Promise<string>
  removeAvatar(userId: string): Promise<void>
}

/** One attendance register per batch per calendar day (`date` is `YYYY-MM-DD`). */
export interface AttendanceSheet {
  batchId: string
  date: string
  records: AttendanceRecord[]
  submittedAt: string | null
}

export type NetBatchInput = Omit<NetBatch, 'id'>

export interface AttendanceRepository {
  listBatches(coachId: string): Promise<NetBatch[]>
  createBatch(coachId: string, input: NetBatchInput): Promise<NetBatch>
  updateBatch(batch: NetBatch): Promise<NetBatch>
  /** Cadets in the batch become unassigned; its registers and session links are removed. */
  deleteBatch(batchId: string): Promise<void>
  listCadets(batchId: string): Promise<Cadet[]>
  getSheet(batchId: string, date: string): Promise<AttendanceSheet | null>
  saveSheet(sheet: AttendanceSheet): Promise<AttendanceSheet>
}

/** Guardian details entered by the coach; `verified` is set only when the guardian accepts. */
export type GuardianInviteInput = Omit<Guardian, 'verified'>

/** Coach-editable cadet fields; an empty `batchId` means the cadet is not in a batch. */
export type CadetInput = Pick<Cadet, 'name' | 'jersey' | 'ageGroup' | 'role' | 'battingHand' | 'bowlingStyle' | 'batchId' | 'feeDue'>

/**
 * How the invite reached the guardian: `sent` over WhatsApp, or `manual` when the coach must share
 * `link` themselves (email contact, WhatsApp not configured, or the send failed — see `reason`).
 */
export interface InviteDelivery {
  status: 'sent' | 'manual'
  link: string | null
  reason?: string
}

export interface GuardianInviteResult {
  cadet: Cadet
  delivery: InviteDelivery
}

/** Guardian details are stored on the cadet row; invites are issued and sent by the backend. */
export interface CadetRepository {
  list(coachId: string): Promise<Cadet[]>
  create(coachId: string, input: CadetInput): Promise<Cadet>
  update(cadetId: string, input: CadetInput): Promise<Cadet>
  /** Also deletes the cadet's logged net sessions. */
  remove(cadetId: string): Promise<void>
  /** Creates or replaces the cadet's guardian invite and tries to deliver it. */
  sendGuardianInvite(cadetId: string, guardian: GuardianInviteInput): Promise<GuardianInviteResult>
  /** Issues a fresh link for a pending invite (older links stop working) and tries to deliver it. */
  resendGuardianInvite(cadetId: string): Promise<GuardianInviteResult>
  /** Cancels a pending invite or removes a linked guardian. */
  unlinkGuardian(cadetId: string): Promise<Cadet>
}

export type GuardianInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface GuardianInvitePreview {
  status: GuardianInviteStatus
  cadetName: string
  coachName: string
  guardianName: string | null
  expiresAt: string
}

/** Guardian side of an invite link; the token comes from the `/invite/:token` URL. */
export interface GuardianInviteService {
  /** Readable without signing in. Returns `null` for an unknown token. */
  preview(token: string): Promise<GuardianInvitePreview | null>
  /** Links the signed-in user to the cadet. Rejects with a message safe to show. */
  accept(token: string): Promise<void>
}

/** Aggregated net-session stats; maps to a Supabase view or RPC over logged deliveries. */
export interface TelemetryRepository {
  /** Returns `null` when the cadet has no logged sessions yet. */
  getBattingTelemetry(cadetId: string): Promise<BattingTelemetry | null>
  /** Every cadet in the coach's squad, ranked by runs within their division. */
  getLeaderboard(coachId: string): Promise<LeaderboardEntry[]>
  /** Sessions logged for a batch on one day, oldest first. */
  listNetSessions(batchId: string, date: string): Promise<NetSession[]>
  /** Logged deliveries are folded into the cadet's telemetry and leaderboard figures. */
  saveNetSession(session: Omit<NetSession, 'id' | 'savedAt'>): Promise<NetSession>
}

export type MatchPlanInput = Omit<MatchPlan, 'id' | 'updatedAt'>

export interface TacticsRepository {
  /** Newest fixture first. */
  list(coachId: string): Promise<MatchPlan[]>
  create(coachId: string, input: MatchPlanInput): Promise<MatchPlan>
  update(planId: string, input: MatchPlanInput): Promise<MatchPlan>
  remove(planId: string): Promise<void>
}
