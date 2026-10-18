<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CloudOff, LoaderCircle, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const retrying = ref(false)

const target = () => (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/ops')

async function retry() {
  retrying.value = true
  try {
    await router.replace(target())
  } finally {
    retrying.value = false
  }
}

async function signOut() {
  await auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center bg-card px-6 text-center">
    <CloudOff class="mb-4 size-10 text-ink-muted" />
    <h1 class="font-serif text-xl font-semibold">We couldn't load your profile</h1>
    <p class="mt-2 text-sm text-ink-muted">Check your connection and try again. If this keeps happening, contact your academy admin.</p>
    <div class="mt-6 flex w-full flex-col gap-3">
      <button
        type="button"
        :disabled="retrying"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        @click="retry"
      >
        <LoaderCircle v-if="retrying" class="size-4 animate-spin" />
        Try again
      </button>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold text-ink-muted hover:bg-cherry-soft hover:text-cherry focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
        @click="signOut"
      >
        <LogOut class="size-4" /> Sign out
      </button>
    </div>
  </div>
</template>
