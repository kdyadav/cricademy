<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { BellRing, ChevronLeft, LoaderCircle, ReceiptIndianRupee, Settings, Smartphone } from 'lucide-vue-next'
import FeeDueSheet from '@/components/fees/FeeDueSheet.vue'
import RaiseFeesSheet from '@/components/fees/RaiseFeesSheet.vue'
import FeeSettingsSheet from '@/components/fees/FeeSettingsSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { useFeesStore } from '@/stores/fees'
import { useOpsStore } from '@/stores/ops'
import { formatDueDate, formatInr, isOverdue } from '@/lib/fees'
import { cn } from '@/lib/cn'
import type { FeeDue } from '@/types'

const auth = useAuthStore()
const fees = useFeesStore()
const cadets = useCadetsStore()
const ops = useOpsStore()
const { dues, settings, loading, error, open, overdue, toConfirm, outstandingTotal, overdueTotal, collectedThisMonth, today } = storeToRefs(fees)

watch(
  () => auth.user?.id,
  (id) => id && Promise.all([fees.load(id, true), cadets.load(id), ops.init(id)]),
  { immediate: true },
)

type Filter = 'confirm' | 'overdue' | 'open' | 'settled'
const filter = ref<Filter>('overdue')
const filters = computed(() =>
  [
    { value: 'confirm' as Filter, label: 'To confirm', count: toConfirm.value.length },
    { value: 'overdue' as Filter, label: 'Overdue', count: overdue.value.length },
    { value: 'open' as Filter, label: 'All open', count: open.value.length },
    { value: 'settled' as Filter, label: 'Paid & waived', count: dues.value.length - open.value.length },
  ].filter((f) => f.value !== 'confirm' || f.count),
)
watch(toConfirm, (list) => list.length === 0 && filter.value === 'confirm' && (filter.value = 'overdue'))

const visible = computed(() => {
  const list = { confirm: toConfirm.value, overdue: overdue.value, open: open.value, settled: dues.value.filter((d) => d.status !== 'due') }[filter.value]
  return filter.value === 'settled' ? list : [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
})
const cadetName = (d: FeeDue) => cadets.byId(d.cadetId)?.name ?? 'Removed cadet'

const sheetOpen = ref(false)
const sheetDueId = ref<string | null>(null)
const raiseOpen = ref(false)
const settingsOpen = ref(false)
function openDue(d: FeeDue) {
  sheetDueId.value = d.id
  sheetOpen.value = true
}
function openSettings() {
  sheetOpen.value = false
  settingsOpen.value = true
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="space-y-4 px-4 pt-3 pb-4">
      <RouterLink :to="{ name: 'cadets' }" class="-ml-1 inline-flex items-center gap-0.5 rounded-full px-1 py-1 text-xs font-semibold text-ink-muted hover:text-ink">
        <ChevronLeft class="size-4" /> Squad
      </RouterLink>
      <header class="flex items-start justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl font-semibold">Fees</h1>
          <p class="text-xs text-ink-muted">Raise dues, send PhonePe pay links and confirm payments.</p>
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button type="button" class="grid size-9 place-items-center rounded-full border border-hairline hover:bg-app" aria-label="Payment settings" @click="openSettings">
            <Settings class="size-4" />
          </button>
          <button type="button" class="inline-flex items-center gap-1.5 rounded-full bg-turf-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-turf-700" @click="raiseOpen = true">
            <ReceiptIndianRupee class="size-3.5" /> Raise fees
          </button>
        </div>
      </header>

      <button
        v-if="!loading && !settings"
        type="button"
        class="flex w-full items-center gap-3 rounded-xl border border-dashed border-turf/50 bg-mint px-4 py-3 text-left text-xs text-turf-700"
        @click="openSettings"
      >
        <Smartphone class="size-5 shrink-0" />
        <span><span class="block font-semibold">Add your UPI ID</span>Parents can then pay from PhonePe or any UPI app.</span>
      </button>

      <section class="card grid grid-cols-3 divide-x divide-hairline p-0" aria-label="Fee summary">
        <div class="px-3 py-3">
          <p class="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">Outstanding</p>
          <p class="mt-0.5 text-lg font-bold tabular-nums">{{ formatInr(outstandingTotal) }}</p>
        </div>
        <div class="px-3 py-3">
          <p class="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">Overdue</p>
          <p :class="cn('mt-0.5 text-lg font-bold tabular-nums', overdueTotal > 0 && 'text-cherry')">{{ formatInr(overdueTotal) }}</p>
        </div>
        <div class="px-3 py-3">
          <p class="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">This month</p>
          <p class="mt-0.5 text-lg font-bold text-turf-700 tabular-nums">{{ formatInr(collectedThisMonth) }}</p>
        </div>
      </section>
    </div>

    <section class="flex-1 border-t border-hairline bg-card" aria-label="Fee dues">
      <div class="no-scrollbar sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-hairline bg-card/95 px-4 py-2.5 backdrop-blur" role="tablist" aria-label="Filter fees">
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
              f.value === 'confirm' && filter !== f.value && 'border-gold bg-gold-soft text-clay',
            )
          "
          @click="filter = f.value"
        >
          {{ f.label }}
          <span :class="cn('tabular-nums', filter === f.value ? 'text-white/70' : 'opacity-70')">{{ f.count }}</span>
        </button>
      </div>

      <div v-if="loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
      <p v-else-if="error" role="alert" class="px-4 py-12 text-center text-sm text-cherry">{{ error }}</p>
      <p v-else-if="!visible.length" class="px-4 py-12 text-center text-sm text-ink-muted">
        {{ dues.length ? 'Nothing here.' : 'No fees raised yet. Tap Raise fees to bill your squad.' }}
      </p>
      <ul v-else class="divide-y divide-hairline">
        <li v-for="d in visible" :key="d.id">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-app" @click="openDue(d)">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ cadetName(d) }}</span>
              <span class="block truncate text-xs text-ink-muted">{{ d.title }} · due {{ formatDueDate(d.dueDate) }}</span>
              <span class="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span v-if="d.reportedReference && d.status === 'due'" class="rounded bg-gold-soft px-1 text-clay">Parent paid · confirm</span>
                <span v-else-if="isOverdue(d, today)" class="rounded bg-cherry-soft px-1 text-cherry">Overdue</span>
                <span v-if="d.status === 'paid'" class="rounded bg-mint px-1 text-turf-700">Paid</span>
                <span v-if="d.status === 'waived'" class="rounded bg-app px-1 text-ink-muted">Waived</span>
                <span v-if="d.remindedAt && d.status === 'due'" class="inline-flex items-center gap-0.5 text-ink-muted">
                  <BellRing class="size-3" /> {{ new Date(d.remindedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }}
                </span>
              </span>
            </span>
            <span :class="cn('shrink-0 text-sm font-bold tabular-nums', d.status === 'paid' && 'text-turf-700', d.status === 'waived' && 'text-ink-muted line-through')">
              {{ formatInr(d.amount) }}
            </span>
          </button>
        </li>
      </ul>
    </section>

    <FeeDueSheet v-model:open="sheetOpen" :due-id="sheetDueId" @setup="openSettings" />
    <RaiseFeesSheet v-model:open="raiseOpen" />
    <FeeSettingsSheet v-model:open="settingsOpen" />
  </div>
</template>
