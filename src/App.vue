<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const route = useRoute()
const router = useRouter()

// Any sign-out (manual or session expiry) sends the user back to the sign-in screen.
watch(
  () => auth.user,
  (user) => {
    if (auth.ready && !user && !route.meta.public) router.replace({ name: 'login' })
  },
)

watch(
  () => auth.user?.id,
  (id) => (id ? notifications.start(id) : notifications.stop()),
  { immediate: true },
)

// Messages from the service worker: a push arrived, or a notification was tapped while the app was open.
function onWorkerMessage(event: MessageEvent<{ type?: string; id?: string; url?: string }>) {
  const { type, id, url } = event.data ?? {}
  if (type === 'notification:received') notifications.refresh()
  if (type === 'notification:open') {
    if (id) notifications.markRead(id)
    if (url) router.push(url)
  }
}

// Realtime can drop while the app is in the background, so catch up when it comes back.
function onVisible() {
  if (document.visibilityState !== 'visible') return
  notifications.refresh()
  notifications.refreshPushState()
}

onMounted(() => {
  navigator.serviceWorker?.addEventListener('message', onWorkerMessage)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  navigator.serviceWorker?.removeEventListener('message', onWorkerMessage)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <!-- Desktop backdrop with centered device frame; full-bleed on mobile -->
  <div class="h-dvh w-full bg-[#ebedeb] sm:py-6">
    <div
      class="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-app sm:rounded-[2rem] sm:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)] sm:ring-1 sm:ring-hairline"
    >
      <RouterView />
    </div>
  </div>
</template>
