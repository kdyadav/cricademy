<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { ChevronRight, LoaderCircle, Save, Trash2, Undo2 } from 'lucide-vue-next'
import BatchSwitcher from '@/components/ops/BatchSwitcher.vue'
import DeliveryPad from '@/components/nets/DeliveryPad.vue'
import SessionScoreboard from '@/components/nets/SessionScoreboard.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import CadetsSegments from '@/components/cadets/CadetsSegments.vue'
import { useAcademyStore } from '@/stores/academy'
import { useNetsStore } from '@/stores/nets'
import { formatOvers, summarize } from '@/lib/netSession'
import { cn } from '@/lib/cn'

const academy = useAcademyStore()
const nets = useNetsStore()
const { batches, activeBatchId, roster, strikerId, striker, drafts, deliveries, sessions, loading, saving, error } = storeToRefs(nets)

watch(
  () => academy.activeId,
  (id) => id && nets.init(id),
  { immediate: true },
)

const batchModel = computed({
  get: () => activeBatchId.value,
  set: (id) => id !== activeBatchId.value && nets.selectBatch(id),
})

const savedRows = computed(() =>
  [...sessions.value].reverse().map((s) => ({
    ...s,
    cadet: roster.value.find((c) => c.id === s.cadetId),
    summary: summarize(s.deliveries),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(s.savedAt)),
  })),
)

function discard() {
  if (window.confirm(`Discard ${deliveries.value.length} unsaved balls for ${striker.value?.name}?`)) nets.discard()
}
</script>

<template>
  <div class="space-y-4 px-4 pt-5 pb-6">
    <CadetsSegments />
    <header>
      <h1 class="font-serif text-2xl font-semibold">Nets telemetry</h1>
      <p class="text-xs text-ink-muted">Log every ball faced. Saved sessions update player stats and the leaderboard.</p>
    </header>

    <BatchSwitcher v-if="batches.length" v-model="batchModel" :batches="batches" />

    <div v-if="loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
    <p v-else-if="!batches.length && !error" class="py-16 text-center text-sm text-ink-muted">
      No net batches yet. Add one in the <RouterLink :to="{ name: 'ops' }" class="font-semibold text-turf">Register</RouterLink>.
    </p>
    <p v-else-if="!roster.length && !error" class="py-16 text-center text-sm text-ink-muted">
      No cadets in this batch yet. Assign them in the <RouterLink :to="{ name: 'cadets' }" class="font-semibold text-turf">Squad</RouterLink> tab.
    </p>

    <template v-else-if="roster.length">
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Batter on strike">
        <button
          v-for="c in roster"
          :key="c.id"
          type="button"
          role="radio"
          :aria-checked="strikerId === c.id"
          :class="
            cn(
              'relative flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition',
              strikerId === c.id ? 'bg-mint text-turf-700' : 'text-ink-muted hover:bg-app',
            )
          "
          @click="strikerId = c.id"
        >
          <UiAvatar :name="c.name" :src="c.avatarUrl" size="md" />
          <span class="w-full truncate text-center">{{ c.name.split(' ')[0] }}</span>
          <span
            v-if="drafts[c.id]?.length"
            class="absolute top-1 right-1 min-w-5 rounded-full bg-gold px-1 text-[10px] leading-5 font-bold text-ink tabular-nums"
            :aria-label="`${drafts[c.id]!.length} unsaved balls`"
          >
            {{ drafts[c.id]!.length }}
          </span>
        </button>
      </div>

      <p v-if="striker" class="flex items-center justify-between text-xs text-ink-muted">
        <span>
          On strike: <span class="font-semibold text-ink">{{ striker.name }}</span> · #{{ striker.jersey }} · {{ striker.battingHand }}-hand
        </span>
        <RouterLink :to="{ name: 'player-stats', params: { id: striker.id } }" class="inline-flex items-center font-semibold text-turf-700">
          Stats <ChevronRight class="size-3.5" />
        </RouterLink>
      </p>

      <SessionScoreboard :deliveries="deliveries" />
      <DeliveryPad :disabled="!striker || saving" @log="nets.logBall" />

      <div class="flex gap-2">
        <button
          type="button"
          class="grid size-12 shrink-0 place-items-center rounded-full border border-hairline hover:bg-app disabled:opacity-40"
          aria-label="Undo last ball"
          :disabled="!deliveries.length || saving"
          @click="nets.undo"
        >
          <Undo2 class="size-4" />
        </button>
        <button
          type="button"
          class="grid size-12 shrink-0 place-items-center rounded-full border border-hairline text-cherry hover:bg-cherry-soft disabled:opacity-40"
          aria-label="Discard unsaved balls"
          :disabled="!deliveries.length || saving"
          @click="discard"
        >
          <Trash2 class="size-4" />
        </button>
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-turf-900 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-40"
          :disabled="!deliveries.length || saving"
          @click="nets.save"
        >
          <LoaderCircle v-if="saving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          Save session
        </button>
      </div>
    </template>

    <p v-if="error" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs font-semibold text-cherry">{{ error }}</p>

    <section v-if="savedRows.length" aria-label="Saved today">
      <h2 class="mb-2 text-sm font-semibold">Saved today</h2>
      <ul class="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
        <li v-for="r in savedRows" :key="r.id" class="flex items-center gap-3 px-3 py-2.5">
          <UiAvatar :name="r.cadet?.name ?? '?'" :src="r.cadet?.avatarUrl" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ r.cadet?.name ?? 'Former cadet' }}</span>
            <span class="block text-[11px] text-ink-muted tabular-nums">{{ r.time }} · {{ formatOvers(r.summary.balls) }} ov · SR {{ r.summary.strikeRate }}</span>
          </span>
          <span class="text-sm font-bold tabular-nums">{{ r.summary.runs }}/{{ r.summary.outs }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
