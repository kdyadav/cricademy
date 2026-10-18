<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { ChevronRight, LoaderCircle, Share2, ThumbsUp, Target, X } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useCadetsStore } from '@/stores/cadets'
import { usePlayerStatsStore } from '@/stores/playerStats'
import { ACADEMY } from '@/data/mock'

const props = defineProps<{ cadetId: string | null; rank?: number }>()
const open = defineModel<boolean>('open', { required: true })

const cadets = useCadetsStore()
const stats = usePlayerStatsStore()
const cadet = computed(() => (props.cadetId ? cadets.byId(props.cadetId) : null))
const telemetry = computed(() => (props.cadetId ? stats.batting[props.cadetId] : undefined))
const error = computed(() => (props.cadetId ? (stats.errors[props.cadetId] ?? null) : null))
const shareStatus = ref<string | null>(null)

watch([open, () => props.cadetId], ([isOpen, id]) => {
  shareStatus.value = null
  if (isOpen && id) stats.load(id)
})

const fmt = (v: number, unit: string) => `${v}${unit}`
const strengths = computed(() =>
  (telemetry.value?.benchmarks ?? []).filter((b) => (b.lowerIsBetter ? b.player <= b.squad : b.player >= b.squad)),
)
const workOns = computed(() => (telemetry.value?.benchmarks ?? []).filter((b) => !strengths.value.includes(b)))
const topDismissal = computed(() => telemetry.value?.dismissals[0] ?? null)

function summary() {
  const c = cadet.value!
  const t = telemetry.value!
  return [
    `${ACADEMY.name} scout dossier`,
    `${c.name} (#${c.jersey}) · ${c.ageGroup} ${c.role} · ${c.battingHand}-hand bat${c.bowlingStyle ? ` · ${c.bowlingStyle}` : ''}`,
    props.rank ? `Division rank: #${props.rank} in ${c.ageGroup}` : '',
    `Runs ${t.totalRuns} (${t.runsCohortDelta >= 0 ? '+' : ''}${t.runsCohortDelta}% vs ${c.ageGroup} avg) · Avg ${t.average} · SR ${t.strikeRate} · Boundary ${t.boundaryPct}%`,
    strengths.value.length ? `Strengths: ${strengths.value.map((b) => `${b.label} ${fmt(b.player, b.unit)}`).join(', ')}` : '',
    workOns.value.length ? `Work-ons: ${workOns.value.map((b) => b.caption).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function share() {
  if (!cadet.value || !telemetry.value) return
  const text = summary()
  try {
    if (navigator.share) {
      await navigator.share({ title: `${cadet.value.name} · scout dossier`, text })
    } else {
      await navigator.clipboard.writeText(text)
      shareStatus.value = 'Dossier copied to clipboard'
    }
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) shareStatus.value = 'Could not share the dossier.'
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-float focus:outline-none"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" aria-hidden="true" />
        <template v-if="cadet">
          <div class="flex items-center gap-3">
            <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="lg" />
            <div class="min-w-0 flex-1">
              <DialogTitle class="truncate font-serif text-xl font-semibold">{{ cadet.name }}</DialogTitle>
              <DialogDescription class="text-xs text-ink-muted">
                Scout dossier · #{{ cadet.jersey }} · {{ cadet.ageGroup }} {{ cadet.role }}<template v-if="rank"> · Rank #{{ rank }}</template>
              </DialogDescription>
            </div>
            <button type="button" class="grid size-9 place-items-center rounded-full hover:bg-app" aria-label="Close" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div v-if="error" role="alert" class="py-10 text-center text-sm text-cherry">
            {{ error }}
            <button type="button" class="mt-2 block w-full font-semibold underline" @click="stats.load(cadet.id, true)">Try again</button>
          </div>
          <div v-else-if="telemetry === undefined" class="grid place-items-center py-12 text-ink-muted">
            <LoaderCircle class="size-6 animate-spin" />
          </div>
          <p v-else-if="telemetry === null" class="py-10 text-center text-sm text-ink-muted">No net sessions logged yet.</p>

          <div v-else class="mt-5 space-y-4">
            <dl class="grid grid-cols-4 gap-1.5 text-center">
              <div v-for="k in [
                { label: 'Runs', value: telemetry.totalRuns },
                { label: 'Avg', value: telemetry.average },
                { label: 'SR', value: telemetry.strikeRate },
                { label: '4s/6s', value: `${telemetry.boundaryPct}%` },
              ]" :key="k.label" class="rounded-lg bg-app px-1 py-2">
                <dt class="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">{{ k.label }}</dt>
                <dd class="text-base leading-tight font-bold tabular-nums">{{ k.value }}</dd>
              </div>
            </dl>

            <section v-if="strengths.length">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ThumbsUp class="size-4 text-turf" /> Strengths</h3>
              <ul class="space-y-1.5">
                <li v-for="b in strengths" :key="b.label" class="flex justify-between gap-2 rounded-lg bg-mint px-3 py-2 text-xs">
                  <span><span class="font-semibold">{{ b.label }}</span> · {{ b.caption }}</span>
                  <span class="shrink-0 font-bold tabular-nums text-turf-700">{{ fmt(b.player, b.unit) }}</span>
                </li>
              </ul>
            </section>

            <section v-if="workOns.length || topDismissal">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Target class="size-4 text-cherry" /> Work-ons</h3>
              <ul class="space-y-1.5">
                <li v-for="b in workOns" :key="b.label" class="flex justify-between gap-2 rounded-lg bg-cherry-soft px-3 py-2 text-xs">
                  <span><span class="font-semibold">{{ b.label }}</span> · {{ b.caption }}</span>
                  <span class="shrink-0 font-bold tabular-nums text-cherry">{{ fmt(b.player, b.unit) }}</span>
                </li>
                <li v-if="topDismissal" class="rounded-lg bg-app px-3 py-2 text-xs">
                  Most common dismissal: <span class="font-semibold">{{ topDismissal.type }}</span> ({{ topDismissal.pct }}%)
                </li>
              </ul>
            </section>

            <p v-if="shareStatus" role="status" class="text-center text-xs font-semibold text-ink-muted">{{ shareStatus }}</p>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700"
                @click="share"
              >
                <Share2 class="size-4" /> Share dossier
              </button>
              <RouterLink
                :to="{ name: 'player-stats', params: { id: cadet.id } }"
                class="flex items-center justify-center gap-1 rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app"
                @click="open = false"
              >
                Full stats <ChevronRight class="size-4" />
              </RouterLink>
            </div>
          </div>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
