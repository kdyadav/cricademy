import type {
  AttendanceRepository,
  AuthService,
  CadetRepository,
  CoachRepository,
  FeePaymentService,
  FeeRepository,
  GuardianInviteService,
  MembershipService,
  StorageService,
  TacticsRepository,
  TelemetryRepository,
} from './types'
import { createMockAuthService } from './mock/auth'
import { createMockCoachRepository } from './mock/coachRepository'
import { createMockStorageService } from './mock/storage'
import { createMockAttendanceRepository } from './mock/attendanceRepository'
import { createMockCadetRepository } from './mock/cadetRepository'
import { createMockTelemetryRepository } from './mock/telemetryRepository'
import { createMockTacticsRepository } from './mock/tacticsRepository'
import { createMockGuardianInviteService } from './mock/guardianInviteService'
import { createMockFeePaymentService, createMockFeeRepository } from './mock/feeRepository'
import { createMockMembershipService } from './mock/membershipService'
import { createSupabaseAuthService } from './supabase/auth'
import { createSupabaseCoachRepository } from './supabase/coachRepository'
import { createSupabaseStorageService } from './supabase/storage'
import { createSupabaseAttendanceRepository } from './supabase/attendanceRepository'
import { createSupabaseCadetRepository } from './supabase/cadetRepository'
import { createSupabaseTelemetryRepository } from './supabase/telemetryRepository'
import { createSupabaseTacticsRepository } from './supabase/tacticsRepository'
import { createSupabaseGuardianInviteService } from './supabase/guardianInviteService'
import { createSupabaseFeePaymentService, createSupabaseFeeRepository } from './supabase/feeRepository'
import { createSupabaseMembershipService } from './supabase/membershipService'
import { supabase } from '@/lib/supabase'

/** True when VITE_SUPABASE_* env vars are set; every repository then reads and writes Supabase. */
export const isSupabaseEnabled = supabase !== null

/** Single swap point for backend implementations: Supabase when configured, localStorage mocks otherwise. */
export const authService: AuthService = supabase ? createSupabaseAuthService(supabase) : createMockAuthService()
export const membershipService: MembershipService = supabase
  ? createSupabaseMembershipService(supabase)
  : createMockMembershipService()
export const coachRepository: CoachRepository = supabase ? createSupabaseCoachRepository(supabase) : createMockCoachRepository()
export const storageService: StorageService = supabase ? createSupabaseStorageService(supabase) : createMockStorageService()
export const attendanceRepository: AttendanceRepository = supabase
  ? createSupabaseAttendanceRepository(supabase)
  : createMockAttendanceRepository()
export const cadetRepository: CadetRepository = supabase ? createSupabaseCadetRepository(supabase) : createMockCadetRepository()
export const telemetryRepository: TelemetryRepository = supabase
  ? createSupabaseTelemetryRepository(supabase)
  : createMockTelemetryRepository()
export const tacticsRepository: TacticsRepository = supabase ? createSupabaseTacticsRepository(supabase) : createMockTacticsRepository()
export const guardianInviteService: GuardianInviteService = supabase
  ? createSupabaseGuardianInviteService(supabase)
  : createMockGuardianInviteService()
export const feeRepository: FeeRepository = supabase ? createSupabaseFeeRepository(supabase) : createMockFeeRepository()
export const feePaymentService: FeePaymentService = supabase
  ? createSupabaseFeePaymentService(supabase)
  : createMockFeePaymentService()

export type * from './types'
