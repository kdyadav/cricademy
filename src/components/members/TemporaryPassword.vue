<script setup lang="ts">
import { ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'

const props = defineProps<{ username: string; password: string }>()
const copied = ref(false)

async function copy() {
  const text = `Username: ${props.username}\nTemporary password: ${props.password}`
  await navigator.clipboard.writeText(text).then(() => (copied.value = true)).catch(() => {})
}
</script>

<template>
  <div class="rounded-xl border border-hairline bg-mint/60 p-3">
    <p class="text-xs text-ink-muted">Share these once. They must set a new password when they first sign in.</p>
    <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt class="text-ink-muted">Username</dt>
      <dd class="font-mono font-semibold break-all">{{ username }}</dd>
      <dt class="text-ink-muted">Password</dt>
      <dd class="font-mono font-semibold break-all">{{ password }}</dd>
    </dl>
    <button
      type="button"
      class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1.5 text-xs font-semibold hover:bg-app"
      @click="copy"
    >
      <Check v-if="copied" class="size-3.5 text-turf" />
      <Copy v-else class="size-3.5" />
      {{ copied ? 'Copied' : 'Copy login details' }}
    </button>
  </div>
</template>
