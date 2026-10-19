<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Check, ChevronLeft, KeyRound, LoaderCircle, LogOut, Users } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { useAuthStore } from '@/stores/auth'
import { useAcademyStore } from '@/stores/academy'
import type { AcademyRole } from '@/services'
import { cn } from '@/lib/cn'

const auth = useAuthStore()
const academy = useAcademyStore()
const router = useRouter()
const { activeMemberships, pending, activeId, profile } = storeToRefs(academy)

const ROLE_LABELS: Record<AcademyRole, string> = { owner: 'Owner', coach: 'Coach', guardian: 'Guardian' }

const busyId = ref<string | null>(null)
const actionError = ref<string | null>(null)

function open(academyId: string) {
  academy.select(academyId)
  router.replace('/')
}

async function respond(academyId: string, accept: boolean) {
  if (!auth.user) return
  actionError.value = null
  busyId.value = academyId
  try {
    await academy.respond(auth.user.id, academyId, accept)
    if (accept) router.replace('/')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Could not update the invitation.'
  } finally {
    busyId.value = null
  }
}

async function signOut() {
  await auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-app">
    <header class="shrink-0 bg-card">
      <div class="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5">
        <button
          v-if="academy.active"
          type="button"
          class="grid size-10 place-items-center rounded-full border border-hairline hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          aria-label="Back"
          @click="router.back()"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="font-serif text-lg font-semibold">Your academies</h1>
          <p v-if="profile?.username" class="text-xs text-ink-muted">Signed in as {{ profile.username }}</p>
        </div>
      </div>
      <div class="h-[3px] outfield-stripes" aria-hidden="true" />
    </header>

    <div class="space-y-6 px-4 py-5">
      <p v-if="actionError" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ actionError }}</p>

      <section v-if="pending.length" class="space-y-2">
        <h2 class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Invitations</h2>
        <div v-for="m in pending" :key="m.academyId" class="card p-4">
          <p class="text-sm">
            <span class="font-semibold">{{ m.academyName }}</span> added you as a {{ ROLE_LABELS[m.role].toLowerCase() }}.
          </p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="busyId !== null"
              class="flex flex-1 items-center justify-center gap-2 rounded-full bg-turf-900 py-2.5 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-70"
              @click="respond(m.academyId, true)"
            >
              <LoaderCircle v-if="busyId === m.academyId" class="size-4 animate-spin" /> Accept
            </button>
            <button
              type="button"
              :disabled="busyId !== null"
              class="flex-1 rounded-full border border-hairline py-2.5 text-sm font-semibold text-ink-muted hover:bg-cherry-soft hover:text-cherry disabled:opacity-70"
              @click="respond(m.academyId, false)"
            >
              Decline
            </button>
          </div>
        </div>
      </section>

      <section v-if="activeMemberships.length" class="space-y-2">
        <h2 class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Switch academy</h2>
        <button
          v-for="m in activeMemberships"
          :key="m.academyId"
          type="button"
          :class="cn('card flex w-full items-center gap-3 p-3 text-left hover:bg-mint/60', m.academyId === activeId && 'ring-2 ring-turf')"
          @click="open(m.academyId)"
        >
          <AcademyCrest />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ m.academyName }}</p>
            <p class="text-xs text-ink-muted">{{ ROLE_LABELS[m.role] }}</p>
          </div>
          <Check v-if="m.academyId === activeId" class="size-4 text-turf" />
        </button>
      </section>

      <p v-if="!pending.length && !activeMemberships.length" class="card p-4 text-center text-sm text-ink-muted">
        You're not part of an academy yet. Ask an academy owner to add you.
      </p>

      <div class="flex flex-col gap-3 pt-2">
        <RouterLink
          v-if="academy.isOwner"
          :to="{ name: 'members' }"
          class="inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold text-ink hover:bg-card"
        >
          <Users class="size-4" /> Manage members of {{ academy.active?.academyName }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'change-password' }"
          class="inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold text-ink hover:bg-card"
        >
          <KeyRound class="size-4" /> Change password
        </RouterLink>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold text-ink-muted hover:bg-cherry-soft hover:text-cherry"
          @click="signOut"
        >
          <LogOut class="size-4" /> Sign out
        </button>
      </div>
    </div>
  </div>
</template>
