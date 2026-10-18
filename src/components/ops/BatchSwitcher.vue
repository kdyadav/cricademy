<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Clock, MapPin } from 'lucide-vue-next'
import type { NetBatch } from '@/types'
import { formatDuration, formatTime, sessionPhase } from '@/lib/time'
import { cn } from '@/lib/cn'

defineProps<{ batches: NetBatch[] }>()
const model = defineModel<string | null>({ required: true })

// Re-evaluate live / upcoming badges every minute.
const now = ref(new Date())
const tick = setInterval(() => (now.value = new Date()), 60_000)
onBeforeUnmount(() => clearInterval(tick))

function phaseLabel(b: NetBatch) {
  const p = sessionPhase(b.start, b.end, now.value)
  if (p.kind === 'live') return { text: 'Live', tone: 'live' as const, sub: `${formatDuration(p.endsIn)} left` }
  if (p.kind === 'upcoming') return { text: 'Upcoming', tone: 'upcoming' as const, sub: `in ${formatDuration(p.startsIn)}` }
  return { text: 'Done', tone: 'done' as const, sub: 'Session ended' }
}
</script>

<template>
  <div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Net batch">
    <button
      v-for="b in batches"
      :key="b.id"
      type="button"
      role="radio"
      :aria-checked="model === b.id"
      :class="
        cn(
          'w-[17rem] shrink-0 snap-start rounded-xl border p-3.5 text-left transition focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none',
          model === b.id ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card hover:bg-app',
        )
      "
      @click="model = b.id"
    >
      <div class="flex items-center justify-between gap-2">
        <span
          :class="
            cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
              model === b.id ? 'bg-white/15 text-white' : 'bg-mint text-turf-700',
            )
          "
        >
          {{ b.ageGroup }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            :class="
              cn(
                'size-1.5 rounded-full',
                phaseLabel(b).tone === 'live' && 'animate-pulse bg-cherry',
                phaseLabel(b).tone === 'upcoming' && 'bg-gold',
                phaseLabel(b).tone === 'done' && (model === b.id ? 'bg-white/40' : 'bg-hairline'),
              )
            "
          />
          {{ phaseLabel(b).text }}
          <span :class="model === b.id ? 'text-white/60' : 'text-ink-muted'">· {{ phaseLabel(b).sub }}</span>
        </span>
      </div>
      <p class="mt-2 truncate font-serif text-[17px] leading-tight font-semibold">{{ b.label }}</p>
      <p :class="cn('mt-0.5 truncate text-xs', model === b.id ? 'text-white/70' : 'text-ink-muted')">{{ b.focus }}</p>
      <div :class="cn('mt-3 flex items-center gap-3 text-[11px] font-medium', model === b.id ? 'text-white/80' : 'text-ink-muted')">
        <span class="inline-flex items-center gap-1 tabular-nums"><Clock class="size-3" /> {{ formatTime(b.start) }} – {{ formatTime(b.end) }}</span>
        <span class="inline-flex min-w-0 items-center gap-1 truncate"><MapPin class="size-3 shrink-0" /> {{ b.pitch }}</span>
      </div>
    </button>
  </div>
</template>
