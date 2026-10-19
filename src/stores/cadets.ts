import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Cadet, LinkStatus } from '@/types'
import { cadetRepository, type AddMemberResult, type CadetInput, type GuardianInviteInput } from '@/services'
import { useOpsStore } from './ops'
import { useNetsStore } from './nets'
import { usePlayerStatsStore } from './playerStats'
import { useFeesStore } from './fees'

export const useCadetsStore = defineStore('cadets', () => {
  const cadets = ref<Cadet[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Cadet id with a guardian action in flight. */
  const busyId = ref<string | null>(null)
  /** Account outcome of the latest guardian added, shown in the guardian sheet; `member` is `null` in demo mode. */
  const lastAdded = ref<{ cadetId: string; member: AddMemberResult | null } | null>(null)
  let loadedForAcademy: string | null = null

  const linkCounts = computed(() => {
    const c: Record<LinkStatus, number> = { linked: 0, pending: 0, unlinked: 0 }
    for (const cadet of cadets.value) c[cadet.linkStatus]++
    return c
  })
  const feesDueTotal = computed(() => cadets.value.reduce((sum, c) => sum + c.feeDue, 0))
  const feesDueCount = computed(() => cadets.value.filter((c) => c.feeDue > 0).length)

  const byId = (id: string) => cadets.value.find((c) => c.id === id) ?? null

  async function load(academyId: string) {
    if (loadedForAcademy === academyId) return
    cadets.value = []
    loading.value = true
    error.value = null
    try {
      cadets.value = await cadetRepository.list(academyId)
      loadedForAcademy = academyId
    } catch {
      error.value = 'Could not load the squad.'
    } finally {
      loading.value = false
    }
  }

  /** Keeps this list and the Daily Ops roster in sync with the saved cadet. */
  function replace(saved: Cadet) {
    cadets.value = cadets.value.map((c) => (c.id === saved.id ? saved : c))
    const ops = useOpsStore()
    if (ops.cadets.some((c) => c.id === saved.id)) {
      ops.cadets = ops.cadets.map((c) => (c.id === saved.id ? saved : c))
    }
  }

  async function run(cadetId: string, action: () => Promise<Cadet>, failure: string) {
    busyId.value = cadetId
    error.value = null
    try {
      const saved = await action()
      replace(saved)
      return saved
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : failure
      throw new Error(error.value)
    } finally {
      busyId.value = null
    }
  }

  function addGuardian(academyId: string, cadetId: string, guardian: GuardianInviteInput) {
    lastAdded.value = null
    return run(
      cadetId,
      async () => {
        const result = await cadetRepository.addGuardian(academyId, cadetId, guardian)
        lastAdded.value = { cadetId, member: result.member }
        return result.cadet
      },
      'Could not add the guardian.',
    )
  }

  const unlink = (cadetId: string) => {
    lastAdded.value = null
    return run(cadetId, () => cadetRepository.unlinkGuardian(cadetId), 'Could not remove the guardian.')
  }

  /** Rosters in Daily Ops, Nets and the leaderboard depend on squad membership, so they reload. */
  function afterSquadChange() {
    useOpsStore().refreshRoster().catch(() => {})
    useNetsStore().invalidate()
    usePlayerStatsStore().invalidate()
  }

  /** Creates a cadet when `cadetId` is omitted, otherwise updates their details. */
  async function save(academyId: string, input: CadetInput, cadetId?: string) {
    const saved = cadetId ? await cadetRepository.update(cadetId, input) : await cadetRepository.create(academyId, input)
    cadets.value = cadetId ? cadets.value.map((c) => (c.id === saved.id ? saved : c)) : [...cadets.value, saved]
    afterSquadChange()
    return saved
  }

  async function remove(cadetId: string) {
    await cadetRepository.remove(cadetId)
    cadets.value = cadets.value.filter((c) => c.id !== cadetId)
    useFeesStore().dropCadet(cadetId)
    afterSquadChange()
  }

  return {
    cadets, loading, error, busyId, lastAdded, linkCounts, feesDueTotal, feesDueCount,
    byId, load, addGuardian, unlink, save, remove,
  }
})
