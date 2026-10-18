<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarDays, ChevronRight, Crown, LoaderCircle, MapPin, Plus, Users } from 'lucide-vue-next'
import MatchPlanEditor from '@/components/tactics/MatchPlanEditor.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { useTacticsStore } from '@/stores/tactics'
import { localDate } from '@/stores/ops'
import type { MatchPlan } from '@/types'
import { cn } from '@/lib/cn'

const auth = useAuthStore()
const squad = useCadetsStore()
const store = useTacticsStore()

watch(
  () => auth.user?.id,
  (id) => id && Promise.all([store.load(id), squad.load(id)]),
  { immediate: true },
)

/** `'new'` opens a blank plan; a plan id opens it for editing. */
const editing = ref<string | null>(null)
const editingPlan = computed(() => (editing.value && editing.value !== 'new' ? store.byId(editing.value) : null))

const today = localDate()
const upcoming = computed(() => store.plans.filter((p) => p.date >= today).reverse())
const past = computed(() => store.plans.filter((p) => p.date < today))
const groups = computed(() => [
  { title: 'Upcoming', plans: upcoming.value },
  { title: 'Past', plans: past.value },
])

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`))
const captainName = (p: MatchPlan) => (p.captainId ? squad.byId(p.captainId)?.name : undefined)
</script>

<template>
  <MatchPlanEditor v-if="editing" :key="editing" :plan="editingPlan" @close="editing = null" />

  <div v-else class="space-y-5 px-4 pt-5 pb-6">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h1 class="font-serif text-2xl font-semibold">Tactics</h1>
        <p class="text-xs text-ink-muted">Pick your match-day XI, batting order and game plan.</p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-turf-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-turf-700"
        @click="editing = 'new'"
      >
        <Plus class="size-3.5" /> New match
      </button>
    </header>

    <div v-if="store.loading" class="grid place-items-center py-16 text-ink-muted"><LoaderCircle class="size-6 animate-spin" /></div>
    <p v-else-if="store.error" role="alert" class="card px-4 py-10 text-center text-sm text-cherry">{{ store.error }}</p>
    <div v-else-if="!store.plans.length" class="card space-y-2 px-4 py-10 text-center">
      <p class="font-serif text-lg font-semibold">No fixtures planned</p>
      <p class="text-xs text-ink-muted">Create a match plan to select an XI from your squad.</p>
    </div>

    <template v-else>
      <template v-for="group in groups" :key="group.title">
        <section v-if="group.plans.length">
          <h2 class="mb-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{{ group.title }} · {{ group.plans.length }}</h2>
          <ul class="space-y-2">
            <li v-for="p in group.plans" :key="p.id">
              <button
                type="button"
                :class="cn('card flex w-full items-center gap-3 p-4 text-left transition hover:bg-app', group.title === 'Past' && 'opacity-75')"
                @click="editing = p.id"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-turf-700 uppercase">{{ p.ageGroup }}</span>
                    <span class="text-[11px] font-semibold text-ink-muted">{{ p.format }}</span>
                  </div>
                  <p class="mt-1.5 truncate font-serif text-lg leading-tight font-semibold">vs {{ p.opponent }}</p>
                  <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                    <span class="inline-flex items-center gap-1"><CalendarDays class="size-3" /> {{ formatDate(p.date) }}</span>
                    <span v-if="p.venue" class="inline-flex items-center gap-1"><MapPin class="size-3" /> {{ p.venue }}</span>
                    <span :class="cn('inline-flex items-center gap-1 font-semibold', p.xi.length === 11 ? 'text-turf-700' : 'text-clay')">
                      <Users class="size-3" /> XI {{ p.xi.length }}/11
                    </span>
                    <span v-if="captainName(p)" class="inline-flex items-center gap-1"><Crown class="size-3" /> {{ captainName(p) }}</span>
                  </p>
                </div>
                <ChevronRight class="size-4 shrink-0 text-ink-muted" />
              </button>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
