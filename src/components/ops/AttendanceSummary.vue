<script setup lang="ts">
import { computed } from 'vue'
import type { AttendanceStatus } from '@/types'
import { ATTENDANCE_STATUS_OPTIONS } from '@/data/options'
import { STATUS_STYLES } from './statusStyles'
import { cn } from '@/lib/cn'

const props = defineProps<{
  counts: Record<AttendanceStatus | 'unmarked', number>
  total: number
}>()

const marked = computed(() => props.total - props.counts.unmarked)
const turnout = computed(() =>
  props.total ? Math.round(((props.counts.present + props.counts.late) / props.total) * 100) : 0,
)
const segments = computed(() =>
  ATTENDANCE_STATUS_OPTIONS.map((o) => ({
    key: o.value,
    pct: props.total ? (props.counts[o.value] / props.total) * 100 : 0,
  })),
)
</script>

<template>
  <section class="card p-4" aria-label="Attendance summary">
    <div class="flex items-end justify-between">
      <div>
        <p class="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Turnout</p>
        <p class="font-serif text-3xl leading-none font-semibold tabular-nums">{{ turnout }}<span class="text-lg">%</span></p>
      </div>
      <p class="text-xs text-ink-muted tabular-nums">
        <span class="font-semibold text-ink">{{ marked }}</span> / {{ total }} marked
      </p>
    </div>

    <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-app" role="presentation">
      <span
        v-for="s in segments"
        :key="s.key"
        :class="cn('h-full transition-[width] duration-300', STATUS_STYLES[s.key].dot)"
        :style="{ width: `${s.pct}%` }"
      />
    </div>

    <dl class="mt-3 grid grid-cols-4 gap-2">
      <div v-for="o in ATTENDANCE_STATUS_OPTIONS" :key="o.value" :class="cn('rounded-lg px-2 py-2 text-center', STATUS_STYLES[o.value].soft)">
        <dt class="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide uppercase opacity-80">
          <component :is="STATUS_STYLES[o.value].icon" class="size-3" /> {{ o.label }}
        </dt>
        <dd class="text-lg leading-tight font-bold tabular-nums">{{ counts[o.value] }}</dd>
      </div>
    </dl>
  </section>
</template>
