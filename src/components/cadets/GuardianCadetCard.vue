<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Clock, LoaderCircle } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { STATUS_STYLES } from '@/components/ops/statusStyles'
import { usePlayerStatsStore } from '@/stores/playerStats'
import { attendanceRepository, type CadetAttendanceEntry } from '@/services'
import { ATTENDANCE_STATUS_OPTIONS } from '@/data/options'
import { formatDueDate, formatInr, isOverdue } from '@/lib/fees'
import { formatTime } from '@/lib/time'
import { localDate } from '@/stores/ops'
import { cn } from '@/lib/cn'
import type { Cadet, FeeDue, NetBatch } from '@/types'

const props = defineProps<{ cadet: Cadet; batch: NetBatch | null; dues: FeeDue[] }>()

const stats = usePlayerStatsStore()
const attendance = ref<CadetAttendanceEntry[]>([])
const attendanceLoading = ref(false)
const attendanceError = ref<string | null>(null)

watch(
  () => props.cadet.id,
  async (id) => {
    stats.load(id)
    attendanceLoading.value = true
    attendanceError.value = null
    try {
      attendance.value = await attendanceRepository.listCadetAttendance(id)
    } catch {
      attendanceError.value = 'Could not load attendance.'
    } finally {
      attendanceLoading.value = false
    }
  },
  { immediate: true },
)

const telemetry = computed(() => stats.batting[props.cadet.id])
const statsLoading = computed(() => stats.loadingId === props.cadet.id || (telemetry.value === undefined && !stats.errors[props.cadet.id]))
const kpis = computed(() => {
  const t = telemetry.value
  if (!t) return []
  return [
    { label: 'Runs', value: t.totalRuns },
    { label: 'Average', value: t.average },
    { label: 'Strike rate', value: t.strikeRate },
    { label: 'Boundary %', value: `${t.boundaryPct}%` },
  ]
})

const counts = computed(() =>
  ATTENDANCE_STATUS_OPTIONS.map((o) => ({ ...o, count: attendance.value.filter((a) => a.status === o.value).length })),
)
const statusLabel = (s: CadetAttendanceEntry['status']) => ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s

const today = localDate()
const openDues = computed(() => props.dues.filter((d) => d.status === 'due'))
const paidDues = computed(() => props.dues.filter((d) => d.status === 'paid').slice(0, 3))
</script>

<template>
  <article class="space-y-3">
    <section class="card flex items-center gap-3 p-4">
      <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="lg" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-lg leading-tight font-semibold">{{ cadet.name }}</h2>
        <p class="text-xs text-ink-muted">#{{ cadet.jersey }} · {{ cadet.ageGroup }} · {{ cadet.role }}</p>
        <p class="truncate text-xs text-ink-muted">
          {{ cadet.battingHand }}-hand bat<template v-if="cadet.bowlingStyle"> · {{ cadet.bowlingStyle }}</template>
        </p>
        <p v-if="batch" class="mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums">
          <Clock class="size-3" /> {{ batch.label }} · {{ formatTime(batch.start) }} – {{ formatTime(batch.end) }}
        </p>
        <p v-else class="mt-1 text-xs text-ink-muted">Not assigned to a batch yet</p>
      </div>
    </section>

    <section class="card p-4">
      <h3 class="text-sm font-semibold">Fees</h3>
      <p v-if="!dues.length" class="mt-1 text-xs text-ink-muted">No fees raised yet.</p>
      <ul v-else class="mt-2 divide-y divide-hairline">
        <li v-for="d in openDues" :key="d.id">
          <RouterLink :to="{ name: 'fee-payment', params: { id: d.id } }" class="flex items-center gap-3 py-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ d.title }}</p>
              <p :class="cn('text-xs', isOverdue(d, today) ? 'font-semibold text-cherry' : 'text-ink-muted')">
                {{ isOverdue(d, today) ? 'Overdue since' : 'Due' }} {{ formatDueDate(d.dueDate) }}
                <template v-if="d.reportedAt"> · Payment reported</template>
              </p>
            </div>
            <span class="text-sm font-semibold tabular-nums">{{ formatInr(d.amount) }}</span>
            <span v-if="!d.reportedAt" class="rounded-full bg-turf-900 px-2.5 py-1 text-[11px] font-semibold text-white">Pay</span>
            <ChevronRight v-else class="size-4 text-ink-muted" />
          </RouterLink>
        </li>
        <li v-for="d in paidDues" :key="d.id" class="flex items-center gap-3 py-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ d.title }}</p>
            <p class="text-xs text-ink-muted">Paid<template v-if="d.paidAt"> {{ formatDueDate(localDate(new Date(d.paidAt))) }}</template></p>
          </div>
          <span class="text-sm font-semibold text-turf-700 tabular-nums">{{ formatInr(d.amount) }}</span>
        </li>
      </ul>
    </section>

    <section class="card p-4">
      <h3 class="text-sm font-semibold">Attendance</h3>
      <div v-if="attendanceLoading" class="flex justify-center py-4"><LoaderCircle class="size-5 animate-spin text-ink-muted" /></div>
      <p v-else-if="attendanceError" role="alert" class="mt-1 text-xs text-cherry">{{ attendanceError }}</p>
      <p v-else-if="!attendance.length" class="mt-1 text-xs text-ink-muted">No sessions marked yet.</p>
      <template v-else>
        <p class="text-xs text-ink-muted">Last {{ attendance.length }} sessions</p>
        <dl class="mt-2 grid grid-cols-4 gap-1.5 text-center">
          <div v-for="c in counts" :key="c.value" :class="cn('rounded-lg py-1.5', STATUS_STYLES[c.value].soft)">
            <dd class="text-lg leading-none font-semibold tabular-nums">{{ c.count }}</dd>
            <dt class="mt-0.5 text-[10px] font-semibold">{{ c.label }}</dt>
          </div>
        </dl>
        <ul class="mt-3 space-y-1.5">
          <li v-for="a in attendance.slice(0, 7)" :key="`${a.batchId}:${a.date}`" class="flex items-center gap-2 text-xs">
            <span :class="cn('size-2 shrink-0 rounded-full', STATUS_STYLES[a.status].dot)" />
            <span class="w-24 shrink-0 tabular-nums">{{ formatDueDate(a.date) }}</span>
            <span class="font-medium">{{ statusLabel(a.status) }}<template v-if="a.status === 'late' && a.lateMinutes"> ({{ a.lateMinutes }} min)</template></span>
            <span v-if="a.note" class="min-w-0 flex-1 truncate text-ink-muted">· {{ a.note }}</span>
          </li>
        </ul>
      </template>
    </section>

    <section class="card p-4">
      <h3 class="text-sm font-semibold">Batting in the nets</h3>
      <div v-if="statsLoading" class="flex justify-center py-4"><LoaderCircle class="size-5 animate-spin text-ink-muted" /></div>
      <p v-else-if="stats.errors[cadet.id]" role="alert" class="mt-1 text-xs text-cherry">{{ stats.errors[cadet.id] }}</p>
      <p v-else-if="!telemetry" class="mt-1 text-xs text-ink-muted">No net sessions logged yet.</p>
      <template v-else>
        <dl class="mt-2 grid grid-cols-4 gap-1.5">
          <div v-for="k in kpis" :key="k.label" class="rounded-lg bg-app p-2 text-center">
            <dd class="font-serif text-lg leading-none font-semibold tabular-nums">{{ k.value }}</dd>
            <dt class="mt-1 text-[10px] font-semibold text-ink-muted">{{ k.label }}</dt>
          </div>
        </dl>
        <div class="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          <span class="h-full bg-turf" :style="{ width: `${telemetry.offSidePct}%` }" />
          <span class="h-full bg-gold" :style="{ width: `${telemetry.legSidePct}%` }" />
        </div>
        <div class="mt-1.5 flex justify-between text-[11px] font-semibold tabular-nums">
          <span>Off side {{ telemetry.offSidePct }}%</span><span>Leg side {{ telemetry.legSidePct }}%</span>
        </div>
      </template>
    </section>
  </article>
</template>
