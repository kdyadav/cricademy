<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import type { Cadet, PlayingRole } from '@/types'
import { cn } from '@/lib/cn'

const XI_SIZE = 11

const props = defineProps<{ pool: Cadet[]; squad: Cadet[] }>()
const xi = defineModel<string[]>('xi', { required: true })
const captainId = defineModel<string | null>('captainId', { required: true })
const keeperId = defineModel<string | null>('keeperId', { required: true })

const byId = (id: string) => props.squad.find((c) => c.id === id)
const selected = computed(() => xi.value.map(byId).filter((c): c is Cadet => !!c))
const bench = computed(() => props.pool.filter((c) => !xi.value.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name)))

const mix = computed(() => {
  const m: Record<PlayingRole, number> = { Batter: 0, Bowler: 0, 'All-Rounder': 0, Wicketkeeper: 0 }
  for (const c of selected.value) m[c.role]++
  return m
})
const warnings = computed(() => {
  const w: string[] = []
  if (selected.value.length && !keeperId.value) w.push('No wicketkeeper chosen')
  if (selected.value.length && !captainId.value) w.push('No captain chosen')
  if (selected.value.length === XI_SIZE && mix.value.Bowler + mix.value['All-Rounder'] < 5) w.push('Fewer than 5 bowling options')
  return w
})

function add(id: string) {
  if (xi.value.length >= XI_SIZE) return
  xi.value = [...xi.value, id]
  if (!keeperId.value && byId(id)?.role === 'Wicketkeeper') keeperId.value = id
}
function drop(id: string) {
  xi.value = xi.value.filter((x) => x !== id)
  if (captainId.value === id) captainId.value = null
  if (keeperId.value === id) keeperId.value = null
}
function move(i: number, delta: number) {
  const next = [...xi.value]
  const j = i + delta
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  xi.value = next
}
const tagClass = (on: boolean) =>
  cn(
    'h-7 min-w-7 rounded-full border px-1.5 text-[10px] font-bold',
    on ? 'border-gold bg-gold text-ink' : 'border-hairline text-ink-muted hover:bg-app',
  )
</script>

<template>
  <section class="space-y-3" aria-label="Playing XI">
    <div class="flex items-end justify-between">
      <h2 class="font-serif text-lg font-semibold">Playing XI</h2>
      <p class="text-xs font-semibold tabular-nums" :class="selected.length === XI_SIZE ? 'text-turf-700' : 'text-ink-muted'">
        {{ selected.length }}/{{ XI_SIZE }}
      </p>
    </div>
    <p class="text-[11px] text-ink-muted">
      {{ mix.Batter }} bat · {{ mix['All-Rounder'] }} all-round · {{ mix.Bowler }} bowl · {{ mix.Wicketkeeper }} keep
    </p>
    <ul v-if="warnings.length" class="space-y-1">
      <li v-for="w in warnings" :key="w" class="rounded-lg bg-gold-soft px-3 py-1.5 text-xs font-semibold text-clay">{{ w }}</li>
    </ul>

    <ol v-if="selected.length" class="card divide-y divide-hairline">
      <li v-for="(c, i) in selected" :key="c.id" class="flex items-center gap-2 px-3 py-2">
        <span class="w-5 text-center text-xs font-bold text-ink-muted tabular-nums">{{ i + 1 }}</span>
        <UiAvatar :name="c.name" :src="c.avatarUrl" size="sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{ c.name }}</span>
          <span class="block truncate text-[11px] text-ink-muted">{{ c.role }} · #{{ c.jersey }}</span>
        </span>
        <button
          type="button"
          :aria-pressed="captainId === c.id"
          :aria-label="`Make ${c.name} captain`"
          :class="tagClass(captainId === c.id)"
          @click="captainId = captainId === c.id ? null : c.id"
        >
          C
        </button>
        <button
          type="button"
          :aria-pressed="keeperId === c.id"
          :aria-label="`Make ${c.name} wicketkeeper`"
          :class="tagClass(keeperId === c.id)"
          @click="keeperId = keeperId === c.id ? null : c.id"
        >
          WK
        </button>
        <div class="flex flex-col">
          <button type="button" class="rounded p-0.5 hover:bg-app disabled:opacity-30" :disabled="i === 0" :aria-label="`Move ${c.name} up`" @click="move(i, -1)">
            <ArrowUp class="size-3.5" />
          </button>
          <button type="button" class="rounded p-0.5 hover:bg-app disabled:opacity-30" :disabled="i === selected.length - 1" :aria-label="`Move ${c.name} down`" @click="move(i, 1)">
            <ArrowDown class="size-3.5" />
          </button>
        </div>
        <button type="button" class="grid size-7 place-items-center rounded-full text-cherry hover:bg-cherry-soft" :aria-label="`Drop ${c.name}`" @click="drop(c.id)">
          <X class="size-3.5" />
        </button>
      </li>
    </ol>
    <p v-else class="card px-4 py-6 text-center text-xs text-ink-muted">Tap players below to build the XI in batting order.</p>

    <div v-if="bench.length">
      <h3 class="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Available · {{ bench.length }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in bench"
          :key="c.id"
          type="button"
          :disabled="selected.length >= XI_SIZE"
          class="inline-flex items-center gap-1 rounded-full border border-hairline bg-card py-1 pr-2.5 pl-1 text-xs font-semibold hover:bg-app disabled:opacity-40"
          @click="add(c.id)"
        >
          <UiAvatar :name="c.name" :src="c.avatarUrl" size="sm" class="size-6!" />
          {{ c.name }}
          <Plus class="size-3 text-ink-muted" />
        </button>
      </div>
    </div>
  </section>
</template>
