<script setup lang="ts">
import { computed } from 'vue'
import { BadgeCheck, ChevronRight, Clock, IndianRupee, Link2Off, UserPlus } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import type { Cadet } from '@/types'
import { formatDuration, minutesUntil } from '@/lib/time'
import { cn } from '@/lib/cn'
import { formatInr } from '@/lib/fees'

const props = defineProps<{ cadet: Cadet; now: Date }>()
const emit = defineEmits<{ manage: [] }>()

const expiresIn = computed(() =>
  props.cadet.linkStatus === 'pending' && props.cadet.inviteExpiresAt ? minutesUntil(props.cadet.inviteExpiresAt, props.now) : null,
)
</script>

<template>
  <li class="flex items-center gap-3 bg-card px-4 py-3">
    <RouterLink
      :to="{ name: 'player-stats', params: { id: cadet.id } }"
      class="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
    >
      <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="md" />
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold">{{ cadet.name }}</span>
          <span class="text-[11px] text-ink-muted tabular-nums">#{{ cadet.jersey }}</span>
        </span>
        <span class="mt-0.5 block truncate text-[11px] text-ink-muted">
          {{ cadet.role }} · {{ cadet.battingHand }}-hand bat<template v-if="cadet.bowlingStyle"> · {{ cadet.bowlingStyle }}</template>
        </span>
        <span class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span v-if="cadet.linkStatus === 'linked'" class="inline-flex items-center gap-0.5 text-turf-700">
            <BadgeCheck class="size-3" /> {{ cadet.guardian?.name }}
          </span>
          <span
            v-else-if="cadet.linkStatus === 'pending'"
            :class="cn('inline-flex items-center gap-0.5 rounded px-1', expiresIn !== null && expiresIn <= 0 ? 'bg-cherry-soft text-cherry' : 'bg-gold-soft text-clay')"
          >
            <Clock class="size-3" />
            <template v-if="expiresIn === null">Waiting to accept</template>
            <template v-else>{{ expiresIn <= 0 ? 'Invite expired' : `Invite · ${formatDuration(expiresIn)} left` }}</template>
          </span>
          <span v-else class="inline-flex items-center gap-0.5 rounded bg-app px-1 text-ink-muted"><Link2Off class="size-3" /> No guardian</span>
          <span v-if="cadet.feeDue" class="inline-flex items-center gap-0.5 rounded bg-cherry-soft px-1 text-cherry">
            <IndianRupee class="size-3" /> {{ formatInr(cadet.feeDue) }} due
          </span>
        </span>
      </span>
    </RouterLink>

    <button
      type="button"
      :aria-label="cadet.linkStatus === 'unlinked' ? `Add guardian for ${cadet.name}` : `Manage guardian for ${cadet.name}`"
      :class="
        cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none',
          cadet.linkStatus === 'unlinked' ? 'bg-turf-900 text-white hover:bg-turf-700' : 'border border-hairline hover:bg-app',
        )
      "
      @click="emit('manage')"
    >
      <template v-if="cadet.linkStatus === 'unlinked'"><UserPlus class="size-3.5" /> Add</template>
      <template v-else>Guardian <ChevronRight class="size-3.5" /></template>
    </button>
  </li>
</template>
