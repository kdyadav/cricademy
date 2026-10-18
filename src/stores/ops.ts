import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AttendanceRecord, AttendanceStatus, Cadet, NetBatch } from '@/types'
import { attendanceRepository, type NetBatchInput } from '@/services'
import { DRILL_FOCUS_OPTIONS } from '@/data/options'
import { useNetsStore } from './nets'
import { useCadetsStore } from './cadets'

const AUTOSAVE_MS = 600

/** Local calendar date as `YYYY-MM-DD`. */
export function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const useOpsStore = defineStore('ops', () => {
  const date = ref(localDate())
  const batches = ref<NetBatch[]>([])
  const activeBatchId = ref<string | null>(null)
  const cadets = ref<Cadet[]>([])
  const records = ref<Record<string, AttendanceRecord>>({})
  const submittedAt = ref<string | null>(null)
  const editing = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  let loadedForCoach: string | null = null
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  const activeBatch = computed(() => batches.value.find((b) => b.id === activeBatchId.value) ?? null)
  const locked = computed(() => submittedAt.value !== null && !editing.value)
  const counts = computed(() => {
    const c: Record<AttendanceStatus | 'unmarked', number> = { present: 0, late: 0, absent: 0, injured: 0, unmarked: 0 }
    for (const cadet of cadets.value) c[records.value[cadet.id]?.status ?? 'unmarked']++
    return c
  })
  const markedCount = computed(() => cadets.value.length - counts.value.unmarked)

  async function init(coachId: string) {
    if (loadedForCoach === coachId) return
    loading.value = true
    error.value = null
    try {
      batches.value = await attendanceRepository.listBatches(coachId)
      loadedForCoach = coachId
      await selectBatch(batches.value[0]?.id ?? null)
    } catch {
      error.value = 'Could not load net batches.'
    } finally {
      loading.value = false
    }
  }

  async function selectBatch(batchId: string | null) {
    clearTimeout(autosaveTimer)
    activeBatchId.value = batchId
    editing.value = false
    error.value = null
    if (!batchId) {
      cadets.value = []
      records.value = {}
      submittedAt.value = null
      return
    }
    loading.value = true
    try {
      const [roster, sheet] = await Promise.all([
        attendanceRepository.listCadets(batchId),
        attendanceRepository.getSheet(batchId, date.value),
      ])
      if (activeBatchId.value !== batchId) return
      cadets.value = roster
      records.value = Object.fromEntries((sheet?.records ?? []).map((r) => [r.cadetId, r]))
      submittedAt.value = sheet?.submittedAt ?? null
    } catch {
      error.value = 'Could not load this batch.'
    } finally {
      loading.value = false
    }
  }

  async function persist(submit: boolean) {
    if (!activeBatchId.value) return
    clearTimeout(autosaveTimer)
    saving.value = true
    error.value = null
    try {
      const saved = await attendanceRepository.saveSheet({
        batchId: activeBatchId.value,
        date: date.value,
        records: Object.values(records.value),
        submittedAt: submit ? new Date().toISOString() : submittedAt.value,
      })
      submittedAt.value = saved.submittedAt
      if (submit) editing.value = false
    } catch {
      error.value = 'Could not save the register. Changes are kept on this device.'
      throw new Error(error.value)
    } finally {
      saving.value = false
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => persist(false).catch(() => {}), AUTOSAVE_MS)
  }

  function update(cadetId: string, patch: Partial<Omit<AttendanceRecord, 'cadetId'>>) {
    if (locked.value) return
    const prev = records.value[cadetId] ?? { cadetId, status: 'present', drillFocus: DRILL_FOCUS_OPTIONS[0] }
    const next: AttendanceRecord = { ...prev, ...patch }
    if (next.status !== 'late') delete next.lateMinutes
    else next.lateMinutes ??= 10
    if (next.status !== 'absent') delete next.excusedByParent
    records.value = { ...records.value, [cadetId]: next }
    scheduleAutosave()
  }

  function setStatus(cadetId: string, status: AttendanceStatus) {
    update(cadetId, { status })
  }

  function clear(cadetId: string) {
    if (locked.value) return
    const { [cadetId]: _removed, ...rest } = records.value
    records.value = rest
    scheduleAutosave()
  }

  function markRemainingPresent() {
    for (const c of cadets.value) if (!records.value[c.id]) update(c.id, { status: 'present' })
  }

  const submit = () => persist(true)

  function startEditing() {
    editing.value = true
  }

  const byStart = (a: NetBatch, b: NetBatch) => a.start.localeCompare(b.start)

  /** Creates a batch when `batchId` is omitted, otherwise updates it. */
  async function saveBatch(coachId: string, input: NetBatchInput, batchId?: string) {
    const saved = batchId
      ? await attendanceRepository.updateBatch({ ...input, id: batchId })
      : await attendanceRepository.createBatch(coachId, input)
    batches.value = [...batches.value.filter((b) => b.id !== saved.id), saved].sort(byStart)
    useNetsStore().invalidate()
    if (!activeBatchId.value) await selectBatch(saved.id)
    return saved
  }

  async function deleteBatch(batchId: string) {
    await attendanceRepository.deleteBatch(batchId)
    batches.value = batches.value.filter((b) => b.id !== batchId)
    useNetsStore().invalidate()
    const squad = useCadetsStore()
    squad.cadets = squad.cadets.map((c) => (c.batchId === batchId ? { ...c, batchId: '' } : c))
    if (activeBatchId.value === batchId) await selectBatch(batches.value[0]?.id ?? null)
  }

  /** Re-reads the active roster, e.g. after cadets are added, edited or moved between batches. */
  async function refreshRoster() {
    if (activeBatchId.value) await selectBatch(activeBatchId.value)
  }

  return {
    date, batches, activeBatchId, activeBatch, cadets, records, submittedAt, editing, loading, saving, error,
    locked, counts, markedCount,
    init, selectBatch, update, setStatus, clear, markRemainingPresent, submit, startEditing,
    saveBatch, deleteBatch, refreshRoster,
  }
})
