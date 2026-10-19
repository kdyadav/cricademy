import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Cadet, Delivery, NetBatch, NetSession } from '@/types'
import { attendanceRepository, telemetryRepository } from '@/services'
import { localDate } from './ops'
import { usePlayerStatsStore } from './playerStats'

export const useNetsStore = defineStore('nets', () => {
  const date = ref(localDate())
  const batches = ref<NetBatch[]>([])
  const activeBatchId = ref<string | null>(null)
  const roster = ref<Cadet[]>([])
  const strikerId = ref<string | null>(null)
  /** Unsaved deliveries per cadet, so the coach can rotate batters without losing balls. */
  const drafts = ref<Record<string, Delivery[]>>({})
  const sessions = ref<NetSession[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  let loadedForAcademy: string | null = null

  const striker = computed(() => roster.value.find((c) => c.id === strikerId.value) ?? null)
  const deliveries = computed(() => (strikerId.value ? (drafts.value[strikerId.value] ?? []) : []))

  async function init(academyId: string) {
    if (loadedForAcademy === academyId) return
    batches.value = []
    roster.value = []
    sessions.value = []
    loading.value = true
    error.value = null
    try {
      batches.value = await attendanceRepository.listBatches(academyId)
      loadedForAcademy = academyId
      const keep = batches.value.find((b) => b.id === activeBatchId.value)
      await selectBatch(keep?.id ?? batches.value[0]?.id ?? null)
    } catch {
      error.value = 'Could not load net batches.'
    } finally {
      loading.value = false
    }
  }

  async function selectBatch(batchId: string | null) {
    activeBatchId.value = batchId
    error.value = null
    roster.value = []
    sessions.value = []
    strikerId.value = null
    if (!batchId) return
    loading.value = true
    try {
      const [cadets, logged] = await Promise.all([
        attendanceRepository.listCadets(batchId),
        telemetryRepository.listNetSessions(batchId, date.value),
      ])
      if (activeBatchId.value !== batchId) return
      roster.value = cadets.sort((a, b) => a.name.localeCompare(b.name))
      sessions.value = logged
      strikerId.value = roster.value[0]?.id ?? null
    } catch {
      error.value = 'Could not load this batch.'
    } finally {
      loading.value = false
    }
  }

  function logBall(ball: Delivery) {
    if (!strikerId.value) return
    drafts.value = { ...drafts.value, [strikerId.value]: [...deliveries.value, ball] }
  }

  function undo() {
    if (!strikerId.value || !deliveries.value.length) return
    drafts.value = { ...drafts.value, [strikerId.value]: deliveries.value.slice(0, -1) }
  }

  function discard() {
    if (!strikerId.value) return
    const { [strikerId.value]: _removed, ...rest } = drafts.value
    drafts.value = rest
  }

  async function save() {
    const cadetId = strikerId.value
    if (!cadetId || !activeBatchId.value || !deliveries.value.length) return
    saving.value = true
    error.value = null
    try {
      const saved = await telemetryRepository.saveNetSession({
        cadetId,
        batchId: activeBatchId.value,
        date: date.value,
        deliveries: deliveries.value,
      })
      sessions.value = [...sessions.value, saved]
      const { [cadetId]: _saved, ...rest } = drafts.value
      drafts.value = rest
      usePlayerStatsStore().invalidate()
    } catch {
      error.value = 'Could not save the session. The balls are still logged on this screen.'
    } finally {
      saving.value = false
    }
  }

  /** Forces the next `init` to reload batches and the roster (unsaved balls are kept). */
  function invalidate() {
    loadedForAcademy = null
  }

  return {
    date, batches, activeBatchId, roster, strikerId, striker, drafts, deliveries, sessions, loading, saving, error,
    init, selectBatch, logBall, undo, discard, save, invalidate,
  }
})
