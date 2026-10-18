import type { CoachRepository } from '../types'
import type { CoachProfile } from '@/types'
import { mockCoach } from '@/data/mock'

const STORAGE_KEY = 'cricademy:coach-profiles'

const latency = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

function readAll(): Record<string, CoachProfile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, CoachProfile>
  } catch {
    /* corrupt storage falls back to seed data */
  }
  return { [mockCoach.id]: structuredClone(mockCoach) }
}

/** localStorage-backed stand-in for the Supabase `coach_profiles` table. */
export function createMockCoachRepository(): CoachRepository {
  return {
    async getByUserId(userId) {
      await latency()
      return readAll()[userId] ?? null
    },
    async upsert(profile) {
      await latency()
      const all = readAll()
      all[profile.id] = profile
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      return structuredClone(profile)
    },
  }
}
