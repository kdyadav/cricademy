<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { Delivery, ShotZone } from '@/types'
import { DISMISSAL_TYPES, SHOT_ZONE_OPTIONS } from '@/data/options'
import { cn } from '@/lib/cn'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ log: [ball: Delivery] }>()

const RUNS: Delivery['runs'][] = [0, 1, 2, 3, 4, 6]
const zone = ref<ShotZone | null>(null)
const beaten = ref(false)
const wicketOpen = ref(false)

function reset() {
  zone.value = null
  beaten.value = false
  wicketOpen.value = false
}

function logRuns(runs: Delivery['runs']) {
  emit('log', { runs, zone: zone.value, inControl: !beaten.value })
  reset()
}

function logWicket(dismissal: string) {
  emit('log', { runs: 0, zone: zone.value, inControl: false, dismissal })
  reset()
}

const toggle = (active: boolean) =>
  cn(
    'flex-1 rounded-full border py-1.5 text-xs font-semibold transition disabled:opacity-40',
    active ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card text-ink-muted hover:bg-app',
  )
</script>

<template>
  <section class="space-y-3" aria-label="Log a delivery">
    <div class="flex gap-1.5" role="radiogroup" aria-label="Shot zone">
      <button
        v-for="z in SHOT_ZONE_OPTIONS"
        :key="z.value"
        type="button"
        role="radio"
        :aria-checked="zone === z.value"
        :disabled="disabled"
        :class="toggle(zone === z.value)"
        @click="zone = zone === z.value ? null : z.value"
      >
        {{ z.label }}
      </button>
      <button type="button" :aria-pressed="beaten" :disabled="disabled" :class="toggle(beaten)" @click="beaten = !beaten">
        Beaten / edge
      </button>
    </div>

    <div v-if="wicketOpen" class="rounded-xl border border-cherry/30 bg-cherry-soft p-2">
      <div class="mb-1.5 flex items-center justify-between px-1">
        <p class="text-xs font-semibold text-cherry">How was the batter out?</p>
        <button type="button" class="grid size-7 place-items-center rounded-full hover:bg-white/60" aria-label="Cancel wicket" @click="wicketOpen = false">
          <X class="size-4" />
        </button>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="d in DISMISSAL_TYPES"
          :key="d"
          type="button"
          class="rounded-lg bg-card px-2 py-2.5 text-xs font-semibold hover:bg-white"
          @click="logWicket(d)"
        >
          {{ d }}
        </button>
      </div>
    </div>

    <div v-else class="grid grid-cols-4 gap-2">
      <button
        v-for="r in RUNS"
        :key="r"
        type="button"
        :disabled="disabled"
        :aria-label="r === 0 ? 'Dot ball' : `${r} runs`"
        :class="
          cn(
            'h-14 rounded-xl text-xl font-bold tabular-nums transition active:scale-95 disabled:opacity-40',
            r === 0 && 'bg-app text-ink-muted',
            r > 0 && r < 4 && 'bg-mint text-turf-700',
            r >= 4 && 'bg-turf-900 text-white',
          )
        "
        @click="logRuns(r)"
      >
        {{ r === 0 ? '•' : r }}
      </button>
      <button
        type="button"
        :disabled="disabled"
        class="col-span-2 h-14 rounded-xl bg-cherry text-sm font-bold tracking-wide text-white uppercase transition active:scale-95 disabled:opacity-40"
        @click="wicketOpen = true"
      >
        Wicket
      </button>
    </div>
  </section>
</template>
