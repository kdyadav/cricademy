<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronRight, Crown, LoaderCircle } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import ScoutDossierSheet from '@/components/showcase/ScoutDossierSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { usePlayerStatsStore } from '@/stores/playerStats'
import type { AgeGroup, LeaderboardEntry } from '@/types'
import { cn } from '@/lib/cn'

const auth = useAuthStore()
const cadets = useCadetsStore()
const stats = usePlayerStatsStore()

watch(
  () => auth.user?.id,
  (uid) => {
    if (!uid) return
    cadets.load(uid)
    stats.loadLeaderboard(uid)
  },
  { immediate: true },
)

type Division = 'all' | AgeGroup
type SortKey = 'runs' | 'strikeRate'
const division = ref<Division>('all')
const sortKey = ref<SortKey>('runs')

const DIVISIONS: AgeGroup[] = ['U-19', 'U-16', 'U-14']
const divisions = computed(() => [
  { value: 'all' as Division, label: 'All', count: stats.leaderboard.length },
  ...DIVISIONS.map((d) => ({ value: d as Division, label: d, count: stats.leaderboard.filter((e) => e.division === d).length })),
])
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'runs', label: 'Runs' },
  { value: 'strikeRate', label: 'Strike rate' },
]

const rows = computed(() =>
  stats.leaderboard
    .filter((e) => division.value === 'all' || e.division === division.value)
    .flatMap((e) => {
      const cadet = cadets.byId(e.cadetId)
      return cadet ? [{ ...e, cadet }] : []
    })
    .sort((a, b) => b[sortKey.value] - a[sortKey.value] || a.cadet.name.localeCompare(b.cadet.name))
    .map((r, i) => ({ ...r, position: i + 1 })),
)
// Podium order: 2nd, 1st, 3rd.
const podium = computed(() => [rows.value[1], rows.value[0], rows.value[2]].filter((r) => r !== undefined))
const metric = (e: LeaderboardEntry) => (sortKey.value === 'runs' ? e.runs : e.strikeRate)
const loading = computed(() => stats.leaderboardLoading || cadets.loading)
const error = computed(() => stats.leaderboardError ?? (!cadets.cadets.length ? cadets.error : null))

const sheetOpen = ref(false)
const selected = ref<LeaderboardEntry | null>(null)
function openDossier(e: LeaderboardEntry) {
  selected.value = e
  sheetOpen.value = true
}
function retry() {
  if (!auth.user) return
  stats.loadLeaderboard(auth.user.id, true)
  cadets.load(auth.user.id)
}

const chip = (active: boolean) =>
  cn(
    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
    active ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card text-ink-muted hover:bg-app',
  )
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="space-y-4 px-4 pt-5 pb-4">
      <header>
        <h1 class="font-serif text-2xl font-semibold">Talent showcase</h1>
        <p class="text-xs text-ink-muted">Net-session leaderboard. Tap a cadet to open and share their scout dossier.</p>
      </header>

      <div class="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Division">
        <button
          v-for="d in divisions"
          :key="d.value"
          type="button"
          role="tab"
          :aria-selected="division === d.value"
          :class="chip(division === d.value)"
          @click="division = d.value"
        >
          {{ d.label }}
          <span :class="cn('tabular-nums', division === d.value ? 'text-white/70' : 'text-ink-muted/70')">{{ d.count }}</span>
        </button>
      </div>

      <div class="flex rounded-full border border-hairline bg-card p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Rank by">
        <button
          v-for="s in SORTS"
          :key="s.value"
          type="button"
          role="radio"
          :aria-checked="sortKey === s.value"
          :class="cn('flex-1 rounded-full py-1.5 transition', sortKey === s.value ? 'bg-mint text-turf-700' : 'text-ink-muted hover:text-ink')"
          @click="sortKey = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
    <div v-else-if="error" role="alert" class="px-4 py-12 text-center text-sm text-cherry">
      {{ error }}
      <button type="button" class="mt-2 block w-full font-semibold underline" @click="retry">Try again</button>
    </div>
    <p v-else-if="!rows.length" class="px-4 py-16 text-center text-sm text-ink-muted">No net sessions logged in this division yet.</p>

    <template v-else>
      <section class="grid grid-cols-3 items-end gap-2 px-4 pb-4" aria-label="Top three">
        <button
          v-for="r in podium"
          :key="r.cadetId"
          type="button"
          class="flex min-w-0 flex-col items-center rounded-xl px-1 pt-2 text-center focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          @click="openDossier(r)"
        >
          <Crown v-if="r.position === 1" class="mb-1 size-5 text-gold" aria-hidden="true" />
          <UiAvatar :name="r.cadet.name" :src="r.cadet.avatarUrl" :size="r.position === 1 ? 'lg' : 'md'" />
          <p class="mt-1.5 w-full truncate text-xs font-semibold">{{ r.cadet.name.split(' ')[0] }}</p>
          <p class="text-sm font-bold tabular-nums">{{ metric(r) }}</p>
          <div
            :class="
              cn(
                'mt-1.5 grid w-full place-items-center rounded-t-lg font-serif text-lg font-semibold',
                r.position === 1 ? 'h-16 bg-turf-900 text-white' : r.position === 2 ? 'h-12 bg-mint-strong text-turf' : 'h-9 bg-gold-soft text-clay',
              )
            "
          >
            {{ r.position }}
          </div>
        </button>
      </section>

      <ol class="flex-1 divide-y divide-hairline border-t border-hairline bg-card" aria-label="Leaderboard">
        <li v-for="r in rows" :key="r.cadetId">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-app" @click="openDossier(r)">
            <span class="w-6 shrink-0 text-center text-sm font-bold text-ink-muted tabular-nums">{{ r.position }}</span>
            <UiAvatar :name="r.cadet.name" :src="r.cadet.avatarUrl" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ r.cadet.name }}</span>
              <span class="block truncate text-[11px] text-ink-muted">{{ r.division }} · {{ r.cadet.role }}</span>
            </span>
            <span class="text-right tabular-nums">
              <span class="block text-sm font-bold">{{ metric(r) }}</span>
              <span class="block text-[11px] text-ink-muted">{{ sortKey === 'runs' ? `SR ${r.strikeRate}` : `${r.runs} runs` }}</span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-ink-muted" />
          </button>
        </li>
      </ol>
    </template>

    <ScoutDossierSheet v-model:open="sheetOpen" :cadet-id="selected?.cadetId ?? null" :rank="selected?.rank" />
  </div>
</template>
