<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Bell, BellRing, CheckCheck, LoaderCircle, Share } from 'lucide-vue-next'
import { useNotificationsStore, type PushState } from '@/stores/notifications'
import type { AppNotification } from '@/types'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/cn'

const store = useNotificationsStore()
const { items, unreadCount, pushState, pushBusy, pushError } = storeToRefs(store)
const router = useRouter()
const open = ref(false)

const toneDot = { info: 'bg-turf-600', alert: 'bg-cherry', success: 'bg-gold' } as const
const showPushRow = (s: PushState) => s !== 'unsupported'

function openItem(n: AppNotification) {
  store.markRead(n.id)
  if (n.url) {
    open.value = false
    router.push(n.url)
  }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      class="relative grid size-10 shrink-0 place-items-center rounded-full border border-hairline text-ink transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
      :aria-label="`Notifications, ${unreadCount} unread`"
    >
      <Bell class="size-[18px]" />
      <span v-if="unreadCount" class="absolute top-2 right-2 size-2 rounded-full bg-cherry ring-2 ring-white" />
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
            @click="store.markAllRead()"
          >
            <CheckCheck class="size-3.5" /> Mark all read
          </button>
        </div>

        <div v-if="showPushRow(pushState)" class="mx-1 mb-1.5 rounded-lg bg-app px-2.5 py-2 text-xs">
          <p v-if="pushState === 'install'" class="text-ink-muted">
            To get alerts on this phone, tap <Share class="inline size-3.5 align-[-2px]" /> Share, then
            <span class="font-semibold text-ink">Add to Home Screen</span>, and open Cricademy from there.
          </p>
          <p v-else-if="pushState === 'denied'" class="text-ink-muted">
            Alerts are blocked. Allow notifications for Cricademy in your phone or browser settings.
          </p>
          <button
            v-else-if="pushState === 'off'"
            class="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-turf px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            :disabled="pushBusy"
            @click="store.enablePush()"
          >
            <LoaderCircle v-if="pushBusy" class="size-3.5 animate-spin" />
            <BellRing v-else class="size-3.5" />
            Turn on phone alerts
          </button>
          <div v-else class="flex items-center justify-between gap-2 text-ink-muted">
            <span class="inline-flex items-center gap-1.5"><BellRing class="size-3.5 text-turf" /> Phone alerts are on</span>
            <button class="font-semibold text-ink hover:underline disabled:opacity-60" :disabled="pushBusy" @click="store.disablePush()">
              Turn off
            </button>
          </div>
          <p v-if="pushError" role="alert" class="mt-1.5 text-cherry">{{ pushError }}</p>
        </div>

        <p v-if="!items.length" class="px-2 py-6 text-center text-xs text-ink-muted">No alerts yet.</p>
        <ul v-else class="max-h-[60vh] divide-y divide-hairline overflow-y-auto">
          <li v-for="n in items" :key="n.id">
            <button
              :class="cn('flex w-full gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-app', !n.read && 'bg-mint/60')"
              @click="openItem(n)"
            >
              <span :class="cn('mt-1.5 size-2 shrink-0 rounded-full', toneDot[n.tone], n.read && 'opacity-30')" />
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold">{{ n.title }}</span>
                <span class="block text-xs text-ink-muted">{{ n.body }}</span>
              </span>
              <span class="text-[10px] text-ink-muted tabular-nums">{{ timeAgo(n.createdAt) }}</span>
            </button>
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
