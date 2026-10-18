<script setup lang="ts">
import { computed } from 'vue'
import type { Delivery } from '@/types'
import { formatOvers, summarize } from '@/lib/netSession'
import { cn } from '@/lib/cn'

const props = defineProps<{ deliveries: Delivery[] }>()

const s = computed(() => summarize(props.deliveries))
const kpis = computed(() => [
  { label: 'SR', value: s.value.strikeRate },
  { label: 'Dot', value: `${s.value.dotPct}%` },
  { label: '4s/6s', value: `${s.value.boundaryPct}%` },
  { label: 'Control', value: `${s.value.controlPct}%` },
])
const zoneTotal = computed(() => s.value.zones.off + s.value.zones.straight + s.value.zones.leg)
const zoneBars = computed(() => [
  { key: 'off', label: 'Off', count: s.value.zones.off, bar: 'bg-turf' },
  { key: 'straight', label: 'Straight', count: s.value.zones.straight, bar: 'bg-gold' },
  { key: 'leg', label: 'Leg', count: s.value.zones.leg, bar: 'bg-clay' },
])

/** Balls of the current over (last 6 when the over is complete). */
const thisOver = computed(() => {
  const n = props.deliveries.length
  const start = n === 0 ? 0 : n - (n % 6 || 6)
  return props.deliveries.slice(start)
})
const ballLabel = (d: Delivery) => (d.dismissal ? 'W' : d.runs === 0 ? '•' : String(d.runs))
</script>

<template>
  <section class="card p-4" aria-label="Session scoreboard">
    <div class="flex items-end justify-between">
      <div>
        <p class="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">This session</p>
        <p class="font-serif text-3xl leading-none font-semibold tabular-nums">
          {{ s.runs }}<span class="text-lg text-ink-muted">/{{ s.outs }}</span>
        </p>
      </div>
      <p class="text-right text-xs text-ink-muted tabular-nums">
        <span class="block text-sm font-semibold text-ink">{{ formatOvers(s.balls) }} ov</span>
        {{ s.balls }} balls
      </p>
    </div>

    <ol class="mt-3 flex min-h-8 gap-1.5" aria-label="This over">
      <li
        v-for="(d, i) in thisOver"
        :key="i"
        :class="
          cn(
            'grid size-8 place-items-center rounded-full text-xs font-bold tabular-nums',
            d.dismissal ? 'bg-cherry text-white' : d.runs >= 4 ? 'bg-turf-900 text-white' : d.runs > 0 ? 'bg-mint text-turf-700' : 'bg-app text-ink-muted',
            !d.inControl && !d.dismissal && 'ring-2 ring-gold ring-offset-1',
          )
        "
      >
        {{ ballLabel(d) }}
      </li>
      <li v-if="!thisOver.length" class="self-center text-xs text-ink-muted">No balls logged yet.</li>
    </ol>

    <dl class="mt-3 grid grid-cols-4 gap-1.5 text-center">
      <div v-for="k in kpis" :key="k.label" class="rounded-lg bg-app px-1 py-2">
        <dt class="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">{{ k.label }}</dt>
        <dd class="text-base leading-tight font-bold tabular-nums">{{ k.value }}</dd>
      </div>
    </dl>

    <div v-if="zoneTotal" class="mt-3">
      <div class="flex h-2 overflow-hidden rounded-full bg-app" role="presentation">
        <span v-for="z in zoneBars" :key="z.key" :class="z.bar" :style="{ width: `${(z.count / zoneTotal) * 100}%` }" />
      </div>
      <p class="mt-1.5 flex justify-between text-[11px] text-ink-muted tabular-nums">
        <span v-for="z in zoneBars" :key="z.key">{{ z.label }} {{ Math.round((z.count / zoneTotal) * 100) }}%</span>
      </p>
    </div>
  </section>
</template>
