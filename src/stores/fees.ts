import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { FeeDue, FeeSettings, FeeStatus } from '@/types'
import { feeRepository, type FeeDueInput, type FeePaymentInput } from '@/services'
import { isOverdue } from '@/lib/fees'
import { localDate, useOpsStore } from './ops'
import { useCadetsStore } from './cadets'

export const useFeesStore = defineStore('fees', () => {
  const dues = ref<FeeDue[]>([])
  const settings = ref<FeeSettings | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loadedForAcademy: string | null = null

  const today = computed(() => localDate())
  const open = computed(() => dues.value.filter((d) => d.status === 'due'))
  const overdue = computed(() => open.value.filter((d) => isOverdue(d, today.value)))
  /** Payments the parent says they made, waiting for the coach to check the UTR. */
  const toConfirm = computed(() => open.value.filter((d) => d.reportedAt))
  const outstandingTotal = computed(() => open.value.reduce((s, d) => s + d.amount, 0))
  const overdueTotal = computed(() => overdue.value.reduce((s, d) => s + d.amount, 0))
  const collectedThisMonth = computed(() => {
    const month = today.value.slice(0, 7)
    return dues.value.filter((d) => d.status === 'paid' && d.paidAt && localDate(new Date(d.paidAt)).startsWith(month)).reduce((s, d) => s + d.amount, 0)
  })

  const byId = (id: string) => dues.value.find((d) => d.id === id) ?? null

  async function load(academyId: string, force = false) {
    if (loadedForAcademy === academyId && !force) return
    if (loadedForAcademy !== academyId) {
      dues.value = []
      settings.value = null
    }
    loading.value = true
    error.value = null
    try {
      const [list, s] = await Promise.all([feeRepository.list(academyId), feeRepository.getSettings(academyId)])
      dues.value = list
      settings.value = s
      loadedForAcademy = academyId
    } catch {
      error.value = 'Could not load fees.'
    } finally {
      loading.value = false
    }
  }

  /** Mirrors the backend's `feeDue` total onto the squad and Daily Ops rosters. */
  function syncCadetTotals(cadetIds: string[]) {
    const cadets = useCadetsStore()
    const ops = useOpsStore()
    for (const id of new Set(cadetIds)) {
      const feeDue = open.value.filter((d) => d.cadetId === id).reduce((s, d) => s + d.amount, 0)
      cadets.cadets = cadets.cadets.map((c) => (c.id === id ? { ...c, feeDue } : c))
      ops.cadets = ops.cadets.map((c) => (c.id === id ? { ...c, feeDue } : c))
    }
  }

  function replace(saved: FeeDue) {
    dues.value = dues.value.map((d) => (d.id === saved.id ? saved : d))
    syncCadetTotals([saved.cadetId])
    return saved
  }

  async function raise(academyId: string, cadetIds: string[], input: FeeDueInput) {
    const created = await feeRepository.create(academyId, cadetIds, input)
    dues.value = [...created, ...dues.value].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    syncCadetTotals(cadetIds)
    return created
  }

  const markPaid = async (dueId: string, payment: FeePaymentInput) => replace(await feeRepository.markPaid(dueId, payment))
  const setStatus = async (dueId: string, status: Exclude<FeeStatus, 'paid'>) => replace(await feeRepository.setStatus(dueId, status))
  const markReminded = async (dueId: string) => replace(await feeRepository.markReminded(dueId))

  async function remove(dueId: string) {
    const due = byId(dueId)
    await feeRepository.remove(dueId)
    dues.value = dues.value.filter((d) => d.id !== dueId)
    if (due) syncCadetTotals([due.cadetId])
  }

  async function saveSettings(academyId: string, input: FeeSettings) {
    settings.value = await feeRepository.saveSettings(academyId, input)
  }

  /** Cadets can be removed elsewhere; their dues go with them. */
  function dropCadet(cadetId: string) {
    dues.value = dues.value.filter((d) => d.cadetId !== cadetId)
  }

  return {
    dues, settings, loading, error, today, open, overdue, toConfirm, outstandingTotal, overdueTotal, collectedThisMonth,
    byId, load, raise, markPaid, setStatus, markReminded, remove, saveSettings, dropCadet,
  }
})
