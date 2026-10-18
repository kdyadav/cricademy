<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, IndianRupee, LoaderCircle, ShieldCheck, UserPlus } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import GuardianLinkSheet from '@/components/cadets/GuardianLinkSheet.vue'
import BenchmarkList from '@/components/stats/BenchmarkList.vue'
import DotBallTrendChart from '@/components/stats/DotBallTrendChart.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { usePlayerStatsStore } from '@/stores/playerStats'
import { LINK_STATUS_LABELS } from '@/data/options'
import { cn } from '@/lib/cn'
import { formatInr } from '@/lib/fees'

const props = defineProps<{ id: string }>()

const auth = useAuthStore()
const cadets = useCadetsStore()
const stats = usePlayerStatsStore()

watch(
  () => auth.user?.id,
  (uid) => uid && cadets.load(uid),
  { immediate: true },
)
watch(
  () => props.id,
  (id) => stats.load(id),
  { immediate: true },
)

const cadet = computed(() => cadets.byId(props.id))
const telemetry = computed(() => stats.batting[props.id])
const loading = computed(() => stats.loadingId === props.id || (telemetry.value === undefined && !stats.errors[props.id]))
const error = computed(() => stats.errors[props.id] ?? null)
const squadLabel = computed(() => `${cadet.value?.ageGroup ?? ''} avg`)

const kpis = computed(() => {
  const t = telemetry.value
  if (!t) return []
  return [
    { label: 'Total runs', value: t.totalRuns, delta: t.runsCohortDelta },
    { label: 'Average', value: t.average },
    { label: 'Strike rate', value: t.strikeRate },
    { label: 'Boundary %', value: `${t.boundaryPct}%` },
  ]
})

const dotBenchmark = computed(() => telemetry.value?.benchmarks.find((b) => b.lowerIsBetter))
const dotChange = computed(() => {
  const trend = telemetry.value?.dotBallTrend ?? []
  return trend.length > 1 ? Math.round((trend[trend.length - 1]! - trend[0]!) * 10) / 10 : 0
})

const sheetOpen = ref(false)
</script>

<template>
  <div class="space-y-4 px-4 pt-3 pb-6">
    <RouterLink
      :to="{ name: 'cadets' }"
      class="-ml-1 inline-flex items-center gap-0.5 rounded-full px-1 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
    >
      <ChevronLeft class="size-4" /> Squad
    </RouterLink>

    <p v-if="!cadets.loading && cadets.error && !cadets.cadets.length" role="alert" class="py-16 text-center text-sm text-cherry">
      {{ cadets.error }}
    </p>
    <p v-else-if="!cadets.loading && cadets.cadets.length && !cadet" class="py-16 text-center text-sm text-ink-muted">
      This cadet isn't in your squad.
    </p>

    <template v-else-if="cadet">
      <section class="card flex items-center gap-4 p-4">
        <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="xl" />
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl leading-tight font-semibold">{{ cadet.name }}</h1>
          <p class="text-xs text-ink-muted">#{{ cadet.jersey }} · {{ cadet.ageGroup }} · {{ cadet.role }}</p>
          <p class="truncate text-xs text-ink-muted">
            {{ cadet.battingHand }}-hand bat<template v-if="cadet.bowlingStyle"> · {{ cadet.bowlingStyle }}</template>
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <button
              type="button"
              :class="
                cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition',
                  cadet.linkStatus === 'linked' && 'bg-mint text-turf-700 hover:bg-mint-strong',
                  cadet.linkStatus === 'pending' && 'bg-gold-soft text-clay',
                  cadet.linkStatus === 'unlinked' && 'bg-turf-900 text-white hover:bg-turf-700',
                )
              "
              @click="sheetOpen = true"
            >
              <UserPlus v-if="cadet.linkStatus === 'unlinked'" class="size-3" />
              <ShieldCheck v-else class="size-3" />
              {{ cadet.linkStatus === 'unlinked' ? 'Invite guardian' : LINK_STATUS_LABELS[cadet.linkStatus] }}
            </button>
            <span v-if="cadet.feeDue" class="inline-flex items-center gap-1 rounded-full bg-cherry-soft px-2 py-0.5 text-cherry">
              <IndianRupee class="size-3" /> {{ formatInr(cadet.feeDue) }} due
            </span>
          </div>
        </div>
      </section>

      <div v-if="loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
      <div v-else-if="error" role="alert" class="py-12 text-center text-sm text-cherry">
        {{ error }}
        <button type="button" class="mt-2 block w-full font-semibold underline" @click="stats.load(id, true)">Try again</button>
      </div>
      <p v-else-if="!telemetry" class="card px-4 py-10 text-center text-sm text-ink-muted">
        No net sessions logged for {{ cadet.name }} yet.
      </p>

      <template v-else>
        <dl class="grid grid-cols-2 gap-2">
          <div v-for="k in kpis" :key="k.label" class="card p-3">
            <dt class="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{{ k.label }}</dt>
            <dd class="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">{{ k.value }}</dd>
            <dd
              v-if="k.delta !== undefined"
              :class="cn('mt-1 text-[11px] font-bold tabular-nums', k.delta >= 0 ? 'text-turf-700' : 'text-cherry')"
            >
              {{ k.delta >= 0 ? '+' : '' }}{{ k.delta }}% vs {{ squadLabel }}
            </dd>
          </div>
        </dl>

        <section class="card p-4">
          <h2 class="text-lg font-semibold">Benchmarks</h2>
          <p class="mb-4 text-xs text-ink-muted">Thick bar: {{ cadet.name.split(' ')[0] }} · thin bar: {{ cadet.ageGroup }} squad average</p>
          <BenchmarkList :metrics="telemetry.benchmarks" :squad-label="squadLabel" />
        </section>

        <section class="card p-4">
          <div class="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold">Dot-ball trend</h2>
              <p class="text-xs text-ink-muted">Last {{ telemetry.dotBallTrend.length }} net sessions · dashed line is squad average</p>
            </div>
            <span
              :class="
                cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', dotChange <= 0 ? 'bg-mint text-turf-700' : 'bg-cherry-soft text-cherry')
              "
            >
              {{ dotChange > 0 ? '+' : '' }}{{ dotChange }} pts
            </span>
          </div>
          <DotBallTrendChart :trend="telemetry.dotBallTrend" :squad="dotBenchmark?.squad ?? 0" />
        </section>

        <section class="card p-4">
          <h2 class="text-lg font-semibold">Scoring zones</h2>
          <p class="mb-3 text-xs text-ink-muted">Share of runs by side of the wicket</p>
          <div class="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
            <span class="h-full bg-turf" :style="{ width: `${telemetry.offSidePct}%` }" />
            <span class="h-full bg-gold" :style="{ width: `${telemetry.legSidePct}%` }" />
          </div>
          <div class="mt-2 flex justify-between text-xs font-semibold tabular-nums">
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-turf" /> Off side {{ telemetry.offSidePct }}%</span>
            <span class="flex items-center gap-1.5">Leg side {{ telemetry.legSidePct }}% <span class="size-2 rounded-full bg-gold" /></span>
          </div>
        </section>

        <section class="card p-4">
          <h2 class="text-lg font-semibold">How they get out</h2>
          <p class="text-xs text-ink-muted">Share of dismissals in net match simulations</p>
          <ul class="mt-3 space-y-2">
            <li v-for="d in telemetry.dismissals" :key="d.type" class="text-xs">
              <div class="flex justify-between font-semibold">
                <span>{{ d.type }}</span><span class="tabular-nums">{{ d.pct }}%</span>
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-app">
                <div class="h-full rounded-full bg-cherry/70" :style="{ width: `${d.pct}%` }" />
              </div>
            </li>
          </ul>
        </section>
      </template>

      <GuardianLinkSheet v-model:open="sheetOpen" :cadet-id="cadet.id" />
    </template>

    <div v-else class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
  </div>
</template>
