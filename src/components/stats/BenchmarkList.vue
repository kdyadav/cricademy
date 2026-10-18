<script setup lang="ts">
import { computed } from 'vue'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { BenchmarkMetric } from '@/types'
import { cn } from '@/lib/cn'

const props = defineProps<{ metrics: BenchmarkMetric[]; squadLabel: string }>()

const rows = computed(() =>
  props.metrics.map((m) => {
    const scale = m.unit === '%' ? 100 : Math.max(m.player, m.squad) * 1.15
    const diff = Math.round((m.player - m.squad) * 10) / 10
    const ahead = m.lowerIsBetter ? diff <= 0 : diff >= 0
    return {
      ...m,
      diff,
      ahead,
      playerWidth: `${Math.min(100, (m.player / scale) * 100)}%`,
      squadWidth: `${Math.min(100, (m.squad / scale) * 100)}%`,
    }
  }),
)
</script>

<template>
  <ul class="space-y-4">
    <li v-for="m in rows" :key="m.label">
      <div class="flex items-baseline justify-between gap-2">
        <p class="text-sm font-semibold">{{ m.label }}</p>
        <p class="flex items-center gap-1.5 text-sm font-bold tabular-nums">
          {{ m.player }}{{ m.unit }}
          <span
            :class="
              cn(
                'inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold',
                m.ahead ? 'bg-mint text-turf-700' : 'bg-cherry-soft text-cherry',
              )
            "
          >
            <component :is="m.diff >= 0 ? TrendingUp : TrendingDown" class="size-3" />
            {{ m.diff > 0 ? '+' : '' }}{{ m.diff }}
          </span>
        </p>
      </div>
      <div class="mt-1.5 space-y-1" aria-hidden="true">
        <div class="h-2 overflow-hidden rounded-full bg-app">
          <div :class="cn('h-full rounded-full transition-[width] duration-500', m.ahead ? 'bg-turf' : 'bg-cherry')" :style="{ width: m.playerWidth }" />
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-app">
          <div class="h-full rounded-full bg-ink-muted/35 transition-[width] duration-500" :style="{ width: m.squadWidth }" />
        </div>
      </div>
      <p class="mt-1 flex justify-between gap-2 text-[11px] text-ink-muted">
        <span>{{ m.caption }}</span>
        <span class="shrink-0 tabular-nums">{{ squadLabel }} {{ m.squad }}{{ m.unit }}</span>
      </p>
    </li>
  </ul>
</template>
