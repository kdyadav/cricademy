<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Bell, CheckCheck, ChevronDown } from 'lucide-vue-next'
import AcademyCrest from './AcademyCrest.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useCoachStore } from '@/stores/coach'
import { useAcademyStore } from '@/stores/academy'
import { cn } from '@/lib/cn'

const coach = useCoachStore()
const academy = useAcademyStore()
const { profile, notifications, unreadCount, coachModeActive } = storeToRefs(coach)

const toneDot = { info: 'bg-turf-600', alert: 'bg-cherry', success: 'bg-gold' } as const
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

      <PopoverRoot>
        <PopoverTrigger
          class="relative grid size-10 place-items-center rounded-full border border-hairline text-ink transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          :aria-label="`Notifications, ${unreadCount} unread`"
        >
          <Bell class="size-[18px]" />
          <span
            v-if="unreadCount"
            class="absolute top-2 right-2 size-2 rounded-full bg-cherry ring-2 ring-white"
          />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="bottom"
            align="end"
            :side-offset="8"
            class="z-50 w-[min(20rem,calc(100vw-2rem))] card p-2 text-ink shadow-float"
          >
            <div class="flex items-center justify-between px-2 py-1.5">
              <p class="font-serif text-base font-semibold">Pavilion Alerts</p>
              <button
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-turf hover:bg-mint disabled:opacity-40"
                :disabled="!unreadCount"
                @click="coach.markAllRead()"
              >
                <CheckCheck class="size-3.5" /> Mark all read
              </button>
            </div>
            <ul class="divide-y divide-hairline">
              <li
                v-for="n in notifications"
                :key="n.id"
                :class="cn('flex gap-2.5 rounded-lg px-2 py-2.5', !n.read && 'bg-mint/60')"
              >
                <span :class="cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[n.tone], n.read && 'opacity-30')" />
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-semibold">{{ n.title }}</p>
                  <p class="text-xs text-ink-muted">{{ n.body }}</p>
                </div>
                <span class="text-[10px] text-ink-muted tabular-nums">{{ n.time }}</span>
              </li>
            </ul>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <RouterLink to="/onboarding" class="relative rounded-full focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none" aria-label="Coach profile">
        <UiAvatar :name="profile?.name ?? 'Coach'" :src="profile?.avatarUrl" size="md" class="ring-hairline" />
      </RouterLink>
    </div>
    <div class="h-[3px] outfield-stripes" aria-hidden="true" />
  </header>
</template>
