<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { z } from 'zod'
import { BadgeCheck, CircleAlert, LoaderCircle, MailCheck } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { useAuthStore } from '@/stores/auth'
import { guardianInviteService, type GuardianInvitePreview } from '@/services'

const props = defineProps<{ token: string }>()
const auth = useAuthStore()

const invite = ref<GuardianInvitePreview | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const email = ref('')
const linkSentTo = ref<string | null>(null)
const busy = ref(false)
const actionError = ref<string | null>(null)
const accepted = ref(false)

const CLOSED: Record<string, string> = {
  expired: 'This invite has expired. Ask the coach to send a new one.',
  revoked: 'The coach cancelled this invite. Ask them to send a new one if this is a mistake.',
}

const closedMessage = computed(() => (invite.value && !accepted.value ? CLOSED[invite.value.status] ?? null : null))
const isLinked = computed(() => accepted.value || invite.value?.status === 'accepted')

onMounted(async () => {
  try {
    invite.value = await guardianInviteService.preview(props.token)
    if (!invite.value) loadError.value = 'This invite link is not valid. Check that you opened the full link.'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load this invite.'
  } finally {
    loading.value = false
  }
})

async function sendLink() {
  actionError.value = null
  const parsed = z.string().trim().email().safeParse(email.value)
  if (!parsed.success) return void (actionError.value = 'Enter a valid email address')
  busy.value = true
  try {
    await auth.sendMagicLink(parsed.data, `${window.location.origin}${window.location.pathname}`)
    linkSentTo.value = parsed.data
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Could not send the sign-in link.'
  } finally {
    busy.value = false
  }
}

async function accept() {
  actionError.value = null
  busy.value = true
  try {
    await guardianInviteService.accept(props.token)
    accepted.value = true
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Could not accept the invite.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card">
    <div class="h-[3px] shrink-0 outfield-stripes" aria-hidden="true" />
    <div class="flex flex-1 flex-col justify-center px-6 py-10">
      <div class="mb-6 flex flex-col items-center text-center">
        <AcademyCrest class="mb-4 scale-125" />
        <h1 class="font-serif text-2xl font-semibold">Guardian invite</h1>
      </div>

      <div v-if="loading" class="flex justify-center py-8"><LoaderCircle class="size-6 animate-spin text-ink-muted" /></div>

      <div v-else-if="loadError || !invite" role="alert" class="flex flex-col items-center gap-2 text-center text-sm text-ink-muted">
        <CircleAlert class="size-8 text-cherry" /> {{ loadError }}
      </div>

      <div v-else-if="isLinked" role="status" class="flex flex-col items-center gap-2 text-center">
        <BadgeCheck class="size-10 text-turf" />
        <p class="font-semibold">You're linked with {{ invite.cadetName }}</p>
        <p class="text-sm text-ink-muted">{{ invite.coachName }} can now send you attendance, fee and progress updates.</p>
      </div>

      <div v-else-if="closedMessage" role="alert" class="flex flex-col items-center gap-2 text-center text-sm text-ink-muted">
        <CircleAlert class="size-8 text-clay" /> {{ closedMessage }}
      </div>

      <div v-else class="space-y-4">
        <p class="text-center text-sm text-ink">
          <template v-if="invite.guardianName">Hello {{ invite.guardianName }}, </template>
          <span class="font-semibold">{{ invite.coachName }}</span> has invited you to link with
          <span class="font-semibold">{{ invite.cadetName }}</span>.
        </p>

        <template v-if="auth.user">
          <p class="text-center text-xs text-ink-muted">Signed in as {{ auth.user.email }}</p>
          <button
            type="button"
            :disabled="busy"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 disabled:opacity-70"
            @click="accept"
          >
            <LoaderCircle v-if="busy" class="size-4 animate-spin" /> Accept and link
          </button>
          <button type="button" class="w-full text-center text-xs font-semibold text-turf hover:underline" @click="auth.signOut()">
            Not you? Use a different email
          </button>
        </template>

        <div v-else-if="linkSentTo" role="status" class="flex flex-col items-center gap-2 text-center">
          <MailCheck class="size-8 text-turf" />
          <p class="text-sm">We sent a sign-in link to <span class="font-semibold">{{ linkSentTo }}</span>.</p>
          <p class="text-xs text-ink-muted">Open it on this device to come back here and accept.</p>
        </div>

        <form v-else class="space-y-3" novalidate @submit.prevent="sendLink">
          <label for="invite-email" class="block text-xs font-semibold text-ink-muted">Your email</label>
          <input
            id="invite-email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            class="field-input"
            placeholder="parent@example.com"
          />
          <button
            type="submit"
            :disabled="busy"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 disabled:opacity-70"
          >
            <LoaderCircle v-if="busy" class="size-4 animate-spin" /> Email me a sign-in link
          </button>
          <p class="text-center text-xs text-ink-muted">No password needed. We'll email you a one-tap link.</p>
        </form>

        <p v-if="actionError" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ actionError }}</p>
      </div>
    </div>
  </div>
</template>
