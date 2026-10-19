<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ChevronDown } from 'lucide-vue-next'
import AcademyCrest from './AcademyCrest.vue'
import NotificationBell from './NotificationBell.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useCoachStore } from '@/stores/coach'
import { useAcademyStore } from '@/stores/academy'
import { cn } from '@/lib/cn'

const coach = useCoachStore()
const academy = useAcademyStore()
const { profile, coachModeActive } = storeToRefs(coach)
</script>

<template>
  <header class="relative z-30 shrink-0 bg-card text-ink">
    <div class="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5">
      <AcademyCrest />

      <div class="min-w-0 flex-1">
        <RouterLink
          :to="{ name: 'academies' }"
          class="flex max-w-full items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          aria-label="Switch academy"
        >
          <span class="truncate font-serif text-[17px] leading-tight font-semibold tracking-tight">{{ academy.active?.academyName }}</span>
          <ChevronDown class="size-4 shrink-0 text-ink-muted" />
          <span v-if="academy.pending.length" class="size-2 shrink-0 rounded-full bg-cherry" aria-label="New invitation" />
        </RouterLink>
        <button
          class="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted"
          @click="coachModeActive = !coachModeActive"
        >
          <span :class="cn('size-1.5 rounded-full', coachModeActive ? 'bg-turf' : 'bg-hairline')" />
          Coach Mode {{ coachModeActive ? 'Active' : 'Paused' }}
        </button>
      </div>

      <NotificationBell />

      <RouterLink to="/onboarding" class="relative rounded-full focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none" aria-label="Coach profile">
        <UiAvatar :name="profile?.name ?? 'Coach'" :src="profile?.avatarUrl" size="md" class="ring-hairline" />
      </RouterLink>
    </div>
    <div class="h-[3px] outfield-stripes" aria-hidden="true" />
  </header>
</template>
