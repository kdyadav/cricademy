import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { BattingTelemetry, LeaderboardEntry } from '@/types'
import { telemetryRepository } from '@/services'

export const usePlayerStatsStore = defineStore('playerStats', () => {
  /** Telemetry cached per cadet id; `null` means the cadet has no logged sessions. */
  const batting = ref<Record<string, BattingTelemetry | null>>({})
  const loadingId = ref<string | null>(null)
  const errors = ref<Record<string, string>>({})

  async function load(cadetId: string, force = false) {
    if (!force && cadetId in batting.value) return
    loadingId.value = cadetId
    delete errors.value[cadetId]
    try {
      batting.value[cadetId] = await telemetryRepository.getBattingTelemetry(cadetId)
    } catch {
      errors.value[cadetId] = 'Could not load player stats.'
    } finally {
      if (loadingId.value === cadetId) loadingId.value = null
    }
  }

  const leaderboard = ref<LeaderboardEntry[]>([])
  const leaderboardLoading = ref(false)
  const leaderboardError = ref<string | null>(null)
  let leaderboardFor: string | null = null

  async function loadLeaderboard(coachId: string, force = false) {
    if (!force && leaderboardFor === coachId) return
    leaderboardLoading.value = true
    leaderboardError.value = null
    try {
      leaderboard.value = await telemetryRepository.getLeaderboard(coachId)
      leaderboardFor = coachId
    } catch {
      leaderboardError.value = 'Could not load the leaderboard.'
    } finally {
      leaderboardLoading.value = false
    }
  }

  /** Drops cached figures after new net sessions are logged so the next view refetches. */
  function invalidate() {
    batting.value = {}
    errors.value = {}
    leaderboardFor = null
  }

  return { batting, loadingId, errors, load, leaderboard, leaderboardLoading, leaderboardError, loadLeaderboard, invalidate }
})
