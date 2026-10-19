<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CalendarDays, CheckCheck, Download, LoaderCircle, Lock, Pencil, Plus, Search, Send, Settings2 } from 'lucide-vue-next'
import BatchSwitcher from '@/components/ops/BatchSwitcher.vue'
import BatchFormSheet from '@/components/ops/BatchFormSheet.vue'
import AttendanceSummary from '@/components/ops/AttendanceSummary.vue'
import CadetAttendanceRow from '@/components/ops/CadetAttendanceRow.vue'
import { useAcademyStore } from '@/stores/academy'
import { useCoachStore } from '@/stores/coach'
import { useOpsStore } from '@/stores/ops'
import { ATTENDANCE_STATUS_OPTIONS } from '@/data/options'
import type { AttendanceStatus, NetBatch } from '@/types'
import { cn } from '@/lib/cn'

const academy = useAcademyStore()
const coach = useCoachStore()
const ops = useOpsStore()
const { batches, activeBatchId, activeBatch, cadets, records, counts, markedCount, submittedAt, locked, loading, error } =
  storeToRefs(ops)

watch(
  () => academy.activeId,
  (id) => id && ops.init(id),
  { immediate: true },
)

const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date())
const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
  return `Good ${part}, ${coach.profile?.name.split(' ')[0] ?? 'Coach'}`
})

type Filter = 'all' | 'unmarked' | AttendanceStatus
const filter = ref<Filter>('all')
const query = ref('')
const expandedId = ref<string | null>(null)

const filters = computed(() => [
  { value: 'all' as Filter, label: 'All', count: cadets.value.length },
  { value: 'unmarked' as Filter, label: 'Unmarked', count: counts.value.unmarked },
  ...ATTENDANCE_STATUS_OPTIONS.map((o) => ({ value: o.value as Filter, label: o.label, count: counts.value[o.value] })),
])

const visibleCadets = computed(() => {
  const q = query.value.trim().toLowerCase()
  return cadets.value.filter((c) => {
    const status = records.value[c.id]?.status ?? 'unmarked'
    if (filter.value !== 'all' && status !== filter.value) return false
    return !q || c.name.toLowerCase().includes(q) || String(c.jersey) === q
  })
})

watch(activeBatchId, () => {
  filter.value = 'all'
  query.value = ''
  expandedId.value = null
})

const submittedTime = computed(() =>
  submittedAt.value ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(submittedAt.value)) : '',
)

const submitting = ref(false)
async function submit() {
  submitting.value = true
  await ops.submit().catch(() => {})
  submitting.value = false
}

const batchSheetOpen = ref(false)
const editingBatch = ref<NetBatch | null>(null)
function openBatchSheet(batch: NetBatch | null) {
  editingBatch.value = batch
  batchSheetOpen.value = true
}

const importing = ref(false)
const importError = ref<string | null>(null)
/** Turns the schedules entered during onboarding into net batches. */
async function importSchedules() {
  const profile = coach.profile
  const academyId = academy.activeId
  if (!profile || !academyId) return
  importing.value = true
  importError.value = null
  try {
    for (const s of profile.schedules) {
      await ops.saveBatch(academyId, { label: s.label, ageGroup: 'U-16', focus: 'General nets', start: s.start, end: s.end, pitch: profile.pitch })
    }
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Could not import your batches.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="space-y-4 px-4 pt-5 pb-4">
      <header>
        <p class="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted"><CalendarDays class="size-3.5" /> {{ today }}</p>
        <h1 class="mt-0.5 font-serif text-2xl font-semibold">{{ greeting }}</h1>
      </header>

      <div v-if="batches.length" class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Today's batches</h2>
          <div class="flex gap-1">
            <button
              v-if="activeBatch"
              type="button"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-card"
              @click="openBatchSheet(activeBatch)"
            >
              <Settings2 class="size-3.5" /> Edit
            </button>
            <button
              v-if="academy.isOwner"
              type="button"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-turf hover:bg-mint"
              @click="openBatchSheet(null)"
            >
              <Plus class="size-3.5" /> Batch
            </button>
          </div>
        </div>
        <BatchSwitcher :model-value="activeBatchId" :batches="batches" @update:model-value="(id) => ops.selectBatch(id)" />
      </div>

      <AttendanceSummary v-if="activeBatch" :counts="counts" :total="cadets.length" />
    </div>

    <section v-if="activeBatch" class="flex-1 border-t border-hairline bg-card" aria-label="Net roster">
      <div class="sticky top-0 z-10 space-y-2.5 border-b border-hairline bg-card/95 px-4 pt-3 pb-2.5 backdrop-blur">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-serif text-lg font-semibold">Net register</h2>
          <button
            v-if="!locked && counts.unmarked"
            type="button"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-turf hover:bg-mint"
            @click="ops.markRemainingPresent()"
          >
            <CheckCheck class="size-3.5" /> Mark rest present
          </button>
        </div>
        <label class="relative block">
          <span class="sr-only">Search cadets</span>
          <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input v-model="query" type="search" class="field-input py-2 pl-9 text-sm" placeholder="Search name or jersey #" />
        </label>
        <div class="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Filter roster">
          <button
            v-for="f in filters"
            :key="f.value"
            type="button"
            role="tab"
            :aria-selected="filter === f.value"
            :class="
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                filter === f.value ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card text-ink-muted hover:bg-app',
              )
            "
            @click="filter = f.value"
          >
            {{ f.label }}
            <span :class="cn('tabular-nums', filter === f.value ? 'text-white/70' : 'text-ink-muted/70')">{{ f.count }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="grid place-items-center py-16 text-ink-muted">
        <LoaderCircle class="size-6 animate-spin" />
      </div>
      <p v-else-if="!visibleCadets.length" class="px-4 py-12 text-center text-sm text-ink-muted">
        {{ cadets.length ? 'No cadets match this filter.' : 'No cadets assigned to this batch yet.' }}
      </p>
      <ul v-else class="divide-y divide-hairline">
        <CadetAttendanceRow
          v-for="c in visibleCadets"
          :key="c.id"
          :cadet="c"
          :record="records[c.id]"
          :locked="locked"
          :expanded="expandedId === c.id"
          @update:expanded="(open) => (expandedId = open ? c.id : null)"
          @status="(s) => ops.setStatus(c.id, s)"
          @update="(patch) => ops.update(c.id, patch)"
          @clear="ops.clear(c.id)"
        />
      </ul>
    </section>

    <div v-else-if="!loading" class="mx-4 card space-y-3 px-4 py-8 text-center">
      <p v-if="error" role="alert" class="text-sm text-cherry">{{ error }}</p>
      <template v-else>
        <p class="font-serif text-lg font-semibold">No net batches yet</p>
        <p v-if="academy.isOwner" class="text-xs text-ink-muted">Add a batch to start taking the register and logging nets.</p>
        <p v-else class="text-xs text-ink-muted">Ask the academy owner to assign you to a batch.</p>
      </template>
      <p v-if="importError" role="alert" class="text-xs text-cherry">{{ importError }}</p>
      <div v-if="academy.isOwner" class="flex flex-col gap-2 pt-1">
        <button
          v-if="coach.profile?.schedules.length"
          type="button"
          :disabled="importing"
          class="flex items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
          @click="importSchedules"
        >
          <LoaderCircle v-if="importing" class="size-4 animate-spin" />
          <Download v-else class="size-4" />
          Use my {{ coach.profile.schedules.length }} onboarding batch{{ coach.profile.schedules.length === 1 ? '' : 'es' }}
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app"
          @click="openBatchSheet(null)"
        >
          <Plus class="size-4" /> Add a batch
        </button>
      </div>
    </div>

    <footer v-if="activeBatch && cadets.length" class="sticky bottom-0 z-10 border-t border-hairline bg-card/95 px-4 py-3 backdrop-blur">
      <p v-if="error" role="alert" class="mb-2 text-xs text-cherry">{{ error }}</p>
      <div v-if="locked" class="flex items-center gap-3">
        <p class="min-w-0 flex-1 text-xs text-ink-muted">
          <span class="flex items-center gap-1 font-semibold text-turf-700"><Lock class="size-3.5" /> Register submitted</span>
          at {{ submittedTime }}
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2.5 text-sm font-semibold hover:bg-app"
          @click="ops.startEditing()"
        >
          <Pencil class="size-3.5" /> Edit
        </button>
      </div>
      <button
        v-else
        type="button"
        :disabled="submitting || counts.unmarked > 0"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        @click="submit"
      >
        <LoaderCircle v-if="submitting" class="size-4 animate-spin" />
        <Send v-else class="size-4" />
        <template v-if="counts.unmarked">{{ counts.unmarked }} cadet{{ counts.unmarked === 1 ? '' : 's' }} unmarked</template>
        <template v-else>{{ submittedAt ? 'Resubmit register' : 'Submit register' }} · {{ markedCount }}/{{ cadets.length }}</template>
      </button>
    </footer>

    <BatchFormSheet v-model:open="batchSheetOpen" :batch="editingBatch" />
  </div>
</template>
