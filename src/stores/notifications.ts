import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { AppNotification } from '@/types'
import { notificationService } from '@/services'
import {
  currentSubscription,
  isIos,
  isStandalone,
  pushConfigured,
  pushSupported,
  setAppBadge,
  subscribePush,
  toInput,
  unsubscribePush,
} from '@/lib/push'

/**
 * `install`: iPhone/iPad in a browser tab, where push only works after Add to Home Screen.
 * `denied`: the user blocked notifications for the app.
 */
export type PushState = 'unsupported' | 'install' | 'denied' | 'off' | 'on'

/** The signed-in user's notifications, kept live over Realtime, and this device's push alerts. */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const pushState = ref<PushState>('unsupported')
  const pushBusy = ref(false)
  const pushError = ref<string | null>(null)
  let startedFor: string | null = null
  let unsubscribe: (() => void) | null = null

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)
  watch(unreadCount, setAppBadge)

  async function refresh() {
    if (!startedFor) return
    items.value = await notificationService.list().catch(() => items.value)
  }

  async function refreshPushState() {
    if (!notificationService.pushAvailable || !pushConfigured) pushState.value = 'unsupported'
    else if (isIos() && !isStandalone()) pushState.value = 'install'
    else if (!pushSupported()) pushState.value = 'unsupported'
    else if (Notification.permission === 'denied') pushState.value = 'denied'
    else {
      const sub = Notification.permission === 'granted' ? await currentSubscription().catch(() => null) : null
      pushState.value = sub ? 'on' : 'off'
    }
  }

  /** Idempotent per user. Re-registers an existing push subscription so it follows the signed-in account. */
  async function start(userId: string) {
    if (startedFor === userId) return
    stop()
    startedFor = userId
    unsubscribe = notificationService.subscribe(userId, (n) => {
      if (!items.value.some((x) => x.id === n.id)) items.value = [n, ...items.value]
    })
    await Promise.all([refresh(), refreshPushState()])
    if (pushState.value === 'on') {
      const sub = await currentSubscription().catch(() => null)
      if (sub) notificationService.savePushSubscription(toInput(sub)).catch(() => {})
    }
  }

  function stop() {
    unsubscribe?.()
    unsubscribe = null
    startedFor = null
    items.value = []
    pushError.value = null
  }

  async function markRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (!n || n.read) return
    n.read = true
    await notificationService.markRead([id]).catch(() => {})
  }

  async function markAllRead() {
    const ids = items.value.filter((n) => !n.read).map((n) => n.id)
    items.value.forEach((n) => (n.read = true))
    await notificationService.markRead(ids).catch(() => {})
  }

  /** Must be called from a tap so the browser shows the permission prompt. */
  async function enablePush() {
    pushBusy.value = true
    pushError.value = null
    try {
      await notificationService.savePushSubscription(await subscribePush())
    } catch (e) {
      pushError.value = e instanceof Error ? e.message : 'Could not turn on alerts.'
    } finally {
      pushBusy.value = false
      await refreshPushState()
    }
  }

  async function disablePush() {
    pushBusy.value = true
    pushError.value = null
    try {
      const endpoint = await unsubscribePush()
      if (endpoint) await notificationService.removePushSubscription(endpoint)
    } catch (e) {
      pushError.value = e instanceof Error ? e.message : 'Could not turn off alerts.'
    } finally {
      pushBusy.value = false
      await refreshPushState()
    }
  }

  /** Before signing out: stops this device receiving the user's alerts. */
  async function detach() {
    if (pushState.value === 'on') await disablePush().catch(() => {})
    stop()
  }

  return {
    items,
    unreadCount,
    pushState,
    pushBusy,
    pushError,
    start,
    stop,
    refresh,
    refreshPushState,
    markRead,
    markAllRead,
    enablePush,
    disablePush,
    detach,
  }
})
