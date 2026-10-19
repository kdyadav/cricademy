<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronRight, IndianRupee, LoaderCircle, Search, UserPlus } from 'lucide-vue-next'
import CadetLinkRow from '@/components/cadets/CadetLinkRow.vue'
import GuardianLinkSheet from '@/components/cadets/GuardianLinkSheet.vue'
import CadetFormSheet from '@/components/cadets/CadetFormSheet.vue'
import { useAcademyStore } from '@/stores/academy'
import { useCadetsStore } from '@/stores/cadets'
import { useOpsStore } from '@/stores/ops'
import type { AgeGroup, Cadet, LinkStatus } from '@/types'
import { cn } from '@/lib/cn'
import { formatInr } from '@/lib/fees'

const academy = useAcademyStore()
const store = useCadetsStore()
const ops = useOpsStore()
const { cadets, loading, error, linkCounts, feesDueTotal, feesDueCount } = storeToRefs(store)

// Batches feed the cadet form's batch picker.
watch(
  () => academy.activeId,
  (id) => id && Promise.all([store.load(id), ops.init(id)]),
  { immediate: true },
)

// Refresh invite countdowns every minute.
const now = ref(new Date())
const tick = setInterval(() => (now.value = new Date()), 60_000)
onBeforeUnmount(() => clearInterval(tick))

type Filter = 'all' | LinkStatus | 'fees'
const filter = ref<Filter>('all')
const query = ref('')

const filters = computed(() => [
  { value: 'all' as Filter, label: 'All', count: cadets.value.length },
  { value: 'linked' as Filter, label: 'Linked', count: linkCounts.value.linked },
  { value: 'pending' as Filter, label: 'Pending', count: linkCounts.value.pending },
  { value: 'unlinked' as Filter, label: 'No guardian', count: linkCounts.value.unlinked },
  { value: 'fees' as Filter, label: 'Fees due', count: feesDueCount.value },
])

const coverage = computed(() => (cadets.value.length ? Math.round((linkCounts.value.linked / cadets.value.length) * 100) : 0))
const tiles = computed(() => [
  { key: 'linked', label: 'Linked', count: linkCounts.value.linked, tone: 'bg-mint text-turf-700', bar: 'bg-turf' },
  { key: 'pending', label: 'Pending', count: linkCounts.value.pending, tone: 'bg-gold-soft text-clay', bar: 'bg-gold' },
  { key: 'unlinked', label: 'No guardian', count: linkCounts.value.unlinked, tone: 'bg-app text-ink', bar: 'bg-ink-muted/40' },
])

const AGE_ORDER: AgeGroup[] = ['U-19', 'U-16', 'U-14']
const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const visible = cadets.value.filter((c) => {
    if (filter.value === 'fees' ? c.feeDue <= 0 : filter.value !== 'all' && c.linkStatus !== filter.value) return false
    return !q || c.name.toLowerCase().includes(q) || String(c.jersey) === q || !!c.guardian?.name.toLowerCase().includes(q)
  })
  return AGE_ORDER.map((age) => ({
    age,
    cadets: visible.filter((c) => c.ageGroup === age).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.cadets.length)
})

const sheetOpen = ref(false)
const sheetCadetId = ref<string | null>(null)
function manage(c: Cadet) {
  sheetCadetId.value = c.id
  sheetOpen.value = true
}

const formOpen = ref(false)
const formCadetId = ref<string | null>(null)
function openForm(cadetId: string | null) {
  sheetOpen.value = false
  formCadetId.value = cadetId
  formOpen.value = true
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="space-y-4 px-4 pt-5 pb-4">
      <header class="flex items-start justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl font-semibold">Squad &amp; guardians</h1>
          <p class="text-xs text-ink-muted">Link every cadet to a parent for fees, sign-offs and progress reports.</p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-turf-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-turf-700"
          @click="openForm(null)"
        >
          <UserPlus class="size-3.5" /> Add cadet
        </button>
      </header>

      <section class="card p-4" aria-label="Guardian coverage">
        <div class="flex items-end justify-between">
          <div>
            <p class="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Guardian coverage</p>
            <p class="font-serif text-3xl leading-none font-semibold tabular-nums">{{ coverage }}<span class="text-lg">%</span></p>
          </div>
          <RouterLink
            :to="{ name: 'fees' }"
            :class="
              cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                feesDueTotal ? 'bg-cherry-soft text-cherry hover:bg-cherry/15' : 'border border-hairline text-ink-muted hover:bg-app',
              )
            "
          >
            <IndianRupee class="size-3.5" />
            <template v-if="feesDueTotal">{{ formatInr(feesDueTotal) }} due · {{ feesDueCount }}</template>
            <template v-else>Fees</template>
            <ChevronRight class="size-3.5" />
          </RouterLink>
        </div>
        <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-app" role="presentation">
          <span
            v-for="t in tiles"
            :key="t.key"
            :class="cn('h-full transition-[width] duration-300', t.bar)"
            :style="{ width: `${cadets.length ? (t.count / cadets.length) * 100 : 0}%` }"
          />
        </div>
        <dl class="mt-3 grid grid-cols-3 gap-2">
          <div v-for="t in tiles" :key="t.key" :class="cn('rounded-lg px-2 py-2 text-center', t.tone)">
            <dt class="text-[10px] font-semibold tracking-wide uppercase opacity-80">{{ t.label }}</dt>
            <dd class="text-lg leading-tight font-bold tabular-nums">{{ t.count }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <section class="flex-1 border-t border-hairline bg-card" aria-label="Squad roster">
      <div class="sticky top-0 z-10 space-y-2.5 border-b border-hairline bg-card/95 px-4 pt-3 pb-2.5 backdrop-blur">
        <label class="relative block">
          <span class="sr-only">Search cadets</span>
          <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input v-model="query" type="search" class="field-input py-2 pl-9 text-sm" placeholder="Search cadet, jersey # or guardian" />
        </label>
        <div class="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Filter squad">
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

      <div v-if="loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
      <p v-else-if="error && !cadets.length" role="alert" class="px-4 py-12 text-center text-sm text-cherry">{{ error }}</p>
      <p v-else-if="!groups.length" class="px-4 py-12 text-center text-sm text-ink-muted">
        {{ cadets.length ? 'No cadets match this filter.' : 'No cadets in your squad yet.' }}
      </p>
      <template v-else>
        <div v-for="g in groups" :key="g.age">
          <h2 class="bg-app px-4 py-1.5 font-sans text-[11px] font-bold tracking-wider text-ink-muted uppercase">
            {{ g.age }} · {{ g.cadets.length }}
          </h2>
          <ul class="divide-y divide-hairline">
            <CadetLinkRow v-for="c in g.cadets" :key="c.id" :cadet="c" :now="now" @manage="manage(c)" />
          </ul>
        </div>
      </template>
    </section>

    <GuardianLinkSheet v-model:open="sheetOpen" :cadet-id="sheetCadetId" @edit-cadet="openForm(sheetCadetId)" />
    <CadetFormSheet v-model:open="formOpen" :cadet-id="formCadetId" />
  </div>
</template>
