import type {
  AppNotification,
  AttendanceRecord,
  BattingTelemetry,
  Cadet,
  CoachProfile,
  FeeDue,
  FeeSettings,
  FeeStatus,
  Guardian,
  LeaderboardEntry,
  NetBatch,
  NetSession,
  PaymentMethod,
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

/** `login` is an email address or a username created by academy staff. */
export interface SignInCredentials {
  login: string
  password: string
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>
  /** Returns an unsubscribe function. */
  onAuthStateChange(handler: AuthChangeHandler): () => void
  /** Rejects with an Error whose message is safe to show to the user. */
  signInWithPassword(credentials: SignInCredentials): Promise<AuthSession>
  /** Sets the signed-in user's password and clears the forced-change flag. Rejects with a message safe to show. */
  updatePassword(password: string): Promise<void>
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

export type AcademyRole = 'owner' | 'coach' | 'guardian'

/** `pending` until the user accepts being added to the academy. */
export interface Membership {
  academyId: string
  academyName: string
  role: AcademyRole
  status: 'active' | 'pending'
}

/** Mirrors `public.profiles`; `username` is `null` for accounts that sign in with email. */
export interface UserProfile {
  id: string
  username: string | null
  displayName: string
  mustChangePassword: boolean
}

/** A person in an academy, as seen by its staff. */
export interface AcademyMember {
  userId: string
  username: string | null
  displayName: string
  role: AcademyRole
  status: Membership['status']
}

export interface AddMemberInput {
  academyId: string
  role: 'coach' | 'guardian'
  username: string
  displayName?: string
  cadetId?: string
  relationship?: string
}

/** `temporaryPassword` is only returned when a new account was created; show it once. */
export interface AddMemberResult {
  userId: string
  username: string
  status: Membership['status']
  created: boolean
  temporaryPassword?: string
}

/** One coach assigned to one batch (`public.batch_coaches`). */
export interface BatchCoach {
  batchId: string
  coachId: string
}

export interface MembershipService {
  getProfile(userId: string): Promise<UserProfile | null>
  /** Active and pending memberships of the user, in every academy. */
  list(userId: string): Promise<Membership[]>
  /** Accepts or declines a pending membership of the signed-in user. Rejects with a message safe to show. */
  respond(academyId: string, accept: boolean): Promise<void>
  /** Everyone in the academy, active and pending. Staff only. */
  listMembers(academyId: string): Promise<AcademyMember[]>
  /** Calls the `create-member` Edge Function. Rejects with a message safe to show. */
  addMember(input: AddMemberInput): Promise<AddMemberResult>
  /** Owner removes a coach or guardian; their batch and cadet links are cleared by the database. */
  removeMember(academyId: string, userId: string): Promise<void>
  /** Calls the `reset-member-password` Edge Function and returns the new temporary password. */
  resetPassword(academyId: string, userId: string): Promise<string>
  listBatchCoaches(academyId: string): Promise<BatchCoach[]>
  setBatchCoach(batchId: string, coachId: string, assigned: boolean): Promise<void>
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

/** One cadet's mark on a submitted register. */
export interface CadetAttendanceEntry {
  date: string
  batchId: string
  status: AttendanceRecord['status']
  lateMinutes?: number
  note?: string
}

export type NetBatchInput = Omit<NetBatch, 'id'>

export interface AttendanceRepository {
  /** Batches of the academy that the signed-in user may see. */
  listBatches(academyId: string): Promise<NetBatch[]>
  createBatch(academyId: string, input: NetBatchInput): Promise<NetBatch>
  updateBatch(batch: NetBatch): Promise<NetBatch>
  /** Cadets in the batch become unassigned; its registers and session links are removed. */
  deleteBatch(batchId: string): Promise<void>
  listCadets(batchId: string): Promise<Cadet[]>
  getSheet(batchId: string, date: string): Promise<AttendanceSheet | null>
  saveSheet(sheet: AttendanceSheet): Promise<AttendanceSheet>
  /** The cadet's marks on submitted registers, newest first. */
  listCadetAttendance(cadetId: string, limit?: number): Promise<CadetAttendanceEntry[]>
}

/** Guardian details entered by the coach; `verified` is set only when the guardian accepts. */
export type GuardianInviteInput = Omit<Guardian, 'verified' | 'username'> & { username: string }

/** Coach-editable cadet fields; an empty `batchId` means the cadet is not in a batch. */
export type CadetInput = Pick<Cadet, 'name' | 'jersey' | 'ageGroup' | 'role' | 'battingHand' | 'bowlingStyle' | 'batchId'>

/** `member` is the account outcome from `create-member`; `null` in demo mode, where no account is created. */
export interface GuardianAddResult {
  cadet: Cadet
  member: AddMemberResult | null
}

/** Guardian details are stored on the cadet row; guardian accounts are created by the backend. */
export interface CadetRepository {
  /** Cadets of the academy that the signed-in user may see. */
  list(academyId: string): Promise<Cadet[]>
  create(academyId: string, input: CadetInput): Promise<Cadet>
  update(cadetId: string, input: CadetInput): Promise<Cadet>
  /** Also deletes the cadet's logged net sessions. */
  remove(cadetId: string): Promise<void>
  /**
   * Links the cadet to the guardian with this username, creating the account if the username is new.
   * Existing users stay `pending` until they accept the academy invitation.
   */
  addGuardian(academyId: string, cadetId: string, guardian: GuardianInviteInput): Promise<GuardianAddResult>
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
  /** Every cadet in the academy's squad, ranked by runs within their division. */
  getLeaderboard(academyId: string): Promise<LeaderboardEntry[]>
  /** Sessions logged for a batch on one day, oldest first. */
  listNetSessions(batchId: string, date: string): Promise<NetSession[]>
  /** Logged deliveries are folded into the cadet's telemetry and leaderboard figures. */
  saveNetSession(session: Omit<NetSession, 'id' | 'savedAt'>): Promise<NetSession>
}

export type FeeDueInput = Pick<FeeDue, 'title' | 'amount' | 'dueDate'>

export interface FeePaymentInput {
  method: PaymentMethod
  reference?: string
}

/** Every change to a due also updates the cadet's `feeDue` total. */
export interface FeeRepository {
  getSettings(academyId: string): Promise<FeeSettings | null>
  saveSettings(academyId: string, settings: FeeSettings): Promise<FeeSettings>
  /** Newest due date first. */
  list(academyId: string): Promise<FeeDue[]>
  /** Raises the same due for each cadet. */
  create(academyId: string, cadetIds: string[], input: FeeDueInput): Promise<FeeDue[]>
  markPaid(dueId: string, payment: FeePaymentInput): Promise<FeeDue>
  /** Waives a due, or reopens a paid or waived one with `due`. */
  setStatus(dueId: string, status: Exclude<FeeStatus, 'paid'>): Promise<FeeDue>
  markReminded(dueId: string): Promise<FeeDue>
  remove(dueId: string): Promise<void>
}

export interface FeePaymentPreview {
  status: FeeStatus
  title: string
  amount: number
  dueDate: string
  cadetName: string
  /** `null` when the coach has not set up UPI payments. */
  payee: FeeSettings | null
  reported: boolean
}

/** Payer side of the `/pay/:id` link; works without signing in. */
export interface FeePaymentService {
  /** Returns `null` for an unknown id. */
  preview(dueId: string): Promise<FeePaymentPreview | null>
  /** Sends the UPI transaction reference for the coach to confirm. Rejects with a message safe to show. */
  report(dueId: string, reference: string): Promise<void>
}

/** A browser Web Push subscription; the keys come from `PushSubscription.toJSON()`. */
export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}

/** Notifications are created by the backend on academy events; the client only reads and marks them. */
export interface NotificationService {
  /** `false` in demo mode, where there is no server to send pushes. */
  readonly pushAvailable: boolean
  /** The signed-in user's notifications, newest first. */
  list(limit?: number): Promise<AppNotification[]>
  markRead(ids: string[]): Promise<void>
  /** Calls `handler` for each notification created for the user while subscribed. Returns an unsubscribe function. */
  subscribe(userId: string, handler: (notification: AppNotification) => void): () => void
  /** Registers this device for push; a device used by another account moves to the signed-in user. */
  savePushSubscription(input: PushSubscriptionInput): Promise<void>
  removePushSubscription(endpoint: string): Promise<void>
}

