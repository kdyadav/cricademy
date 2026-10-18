import type { TacticsRepository } from '../types'
import type { MatchPlan } from '@/types'
import { newId } from '@/lib/id'

const STORAGE_KEY = 'cricademy:match-plans'

const latency = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function readPlans(): MatchPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MatchPlan[]
  } catch {
    /* corrupt storage starts empty */
  }
  return []
}

const writePlans = (plans: MatchPlan[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
const newestFirst = (a: MatchPlan, b: MatchPlan) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)

/** localStorage-backed stand-in for the Supabase `match_plans` table. */
export function createMockTacticsRepository(): TacticsRepository {
  return {
    async list() {
      await latency()
      return readPlans().sort(newestFirst)
    },
    async create(_coachId, input) {
      await latency()
      const plan: MatchPlan = { ...structuredClone(input), id: newId(), updatedAt: new Date().toISOString() }
      writePlans([...readPlans(), plan])
      return structuredClone(plan)
    },
    async update(planId, input) {
      await latency()
      const all = readPlans()
      if (!all.some((p) => p.id === planId)) throw new Error('Match plan not found.')
      const plan: MatchPlan = { ...structuredClone(input), id: planId, updatedAt: new Date().toISOString() }
      writePlans(all.map((p) => (p.id === planId ? plan : p)))
      return structuredClone(plan)
    },
    async remove(planId) {
      await latency()
      writePlans(readPlans().filter((p) => p.id !== planId))
    },
  }
}
