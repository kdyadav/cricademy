<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// Any sign-out (manual or session expiry) sends the user back to the sign-in screen.
watch(
  () => auth.user,
  (user) => {
    if (auth.ready && !user && !route.meta.public) router.replace({ name: 'login' })
  },
)
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
