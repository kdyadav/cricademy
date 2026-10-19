import type { PushSubscriptionInput } from '@/services'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushConfigured = !!VAPID_PUBLIC_KEY

/** True when this browser can receive Web Push and the app has a VAPID key. */
export const pushSupported = () =>
  pushConfigured && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iPhone and iPad only allow push once the app is added to the Home Screen. */
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
}

async function registration() {
  return navigator.serviceWorker.ready
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  return (await registration()).pushManager.getSubscription()
}

export function toInput(sub: PushSubscription): PushSubscriptionInput {
  const keys = sub.toJSON().keys ?? {}
  return { endpoint: sub.endpoint, p256dh: keys.p256dh ?? '', auth: keys.auth ?? '', userAgent: navigator.userAgent.slice(0, 300) }
}

function base64UrlToBytes(value: string) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** Asks for permission (must run from a tap) and subscribes this browser. Rejects with a message safe to show. */
export async function subscribePush(): Promise<PushSubscriptionInput> {
  if (!pushSupported()) throw new Error('This browser cannot show alerts.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Alerts are blocked. Allow notifications for Cricademy in your settings.')
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!) }))
  return toInput(sub)
}

/** Returns the endpoint that was removed, if any. */
export async function unsubscribePush() {
  const sub = await currentSubscription()
  if (!sub) return null
  await sub.unsubscribe()
  return sub.endpoint
}

/** Sets the app icon badge where supported (installed apps on Android, iOS and desktop). */
export function setAppBadge(count: number) {
  const nav = navigator as { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  ;(count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {})
}
