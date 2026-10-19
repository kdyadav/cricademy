import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MatchPlan } from '@/types'
import { tacticsRepository, type MatchPlanInput } from '@/services'

const newestFirst = (a: MatchPlan, b: MatchPlan) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)

export const useTacticsStore = defineStore('tactics', () => {
  const plans = ref<MatchPlan[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loadedForAcademy: string | null = null

  const byId = (id: string) => plans.value.find((p) => p.id === id) ?? null

  async function load(academyId: string) {
    if (loadedForAcademy === academyId) return
    plans.value = []
    loading.value = true
    error.value = null
    try {
      plans.value = await tacticsRepository.list(academyId)
      loadedForAcademy = academyId
    } catch {
      error.value = 'Could not load match plans.'
    } finally {
      loading.value = false
    }
  }

  /** Creates a plan when `planId` is omitted, otherwise updates it. */
  async function save(academyId: string, input: MatchPlanInput, planId?: string) {
    const saved = planId ? await tacticsRepository.update(planId, input) : await tacticsRepository.create(academyId, input)
    plans.value = [...plans.value.filter((p) => p.id !== saved.id), saved].sort(newestFirst)
    return saved
  }

  async function remove(planId: string) {
    await tacticsRepository.remove(planId)
    plans.value = plans.value.filter((p) => p.id !== planId)
  }

  return { plans, loading, error, byId, load, save, remove }
})
