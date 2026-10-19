<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, KeyRound, ListChecks, LoaderCircle, Trash2, UserPlus } from 'lucide-vue-next'
import AddCoachSheet from '@/components/members/AddCoachSheet.vue'
import CoachBatchesSheet from '@/components/members/CoachBatchesSheet.vue'
import TemporaryPassword from '@/components/members/TemporaryPassword.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useAcademyStore } from '@/stores/academy'
import { useOpsStore } from '@/stores/ops'
import { membershipService, type AcademyMember, type BatchCoach } from '@/services'
import { cn } from '@/lib/cn'

const academy = useAcademyStore()
const ops = useOpsStore()
const router = useRouter()

const members = ref<AcademyMember[]>([])
const batchCoaches = ref<BatchCoach[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)
const confirmRemoveId = ref<string | null>(null)
const reset = ref<{ userId: string; username: string; password: string } | null>(null)
const addOpen = ref(false)
const batchesOpen = ref(false)
const batchesFor = ref<AcademyMember | null>(null)

const sections = computed(() => [
  { title: 'Coaches', list: members.value.filter((m) => m.role !== 'guardian') },
  { title: 'Guardians', list: members.value.filter((m) => m.role === 'guardian') },
])
const assigned = computed(() => new Set(batchCoaches.value.filter((bc) => bc.coachId === batchesFor.value?.userId).map((bc) => bc.batchId)))
const chip =
  'inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold hover:bg-app disabled:opacity-60'
const batchCount = (userId: string) => batchCoaches.value.filter((bc) => bc.coachId === userId).length

async function load() {
  const id = academy.activeId
  if (!id) return
  loading.value = true
  error.value = null
  try {
    ;[members.value, batchCoaches.value] = await Promise.all([
      membershipService.listMembers(id),
      membershipService.listBatchCoaches(id),
      ops.init(id),
    ])
  } catch (e) {
    error.value = e instanceof Error && e.message ? e.message : 'Could not load members.'
  } finally {
    loading.value = false
  }
}
watch(() => academy.activeId, load, { immediate: true })

async function run(userId: string, action: () => Promise<void>) {
  busyId.value = userId
  error.value = null
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error && e.message ? e.message : 'Something went wrong.'
  } finally {
    busyId.value = null
  }
}

const resetPassword = (m: AcademyMember) =>
  run(m.userId, async () => {
    const password = await membershipService.resetPassword(academy.activeId!, m.userId)
    reset.value = { userId: m.userId, username: m.username ?? '', password }
  })

function remove(m: AcademyMember) {
  if (confirmRemoveId.value !== m.userId) return void (confirmRemoveId.value = m.userId)
  return run(m.userId, async () => {
    await membershipService.removeMember(academy.activeId!, m.userId)
    members.value = members.value.filter((x) => x.userId !== m.userId)
    batchCoaches.value = batchCoaches.value.filter((bc) => bc.coachId !== m.userId)
    confirmRemoveId.value = null
  })
}

function openBatches(m: AcademyMember) {
  batchesFor.value = m
  batchesOpen.value = true
}

async function toggleBatch(batchId: string, assign: boolean) {
  const coachId = batchesFor.value!.userId
  await membershipService.setBatchCoach(batchId, coachId, assign)
  batchCoaches.value = assign
    ? [...batchCoaches.value, { batchId, coachId }]
    : batchCoaches.value.filter((bc) => !(bc.batchId === batchId && bc.coachId === coachId))
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-app">
    <header class="shrink-0 bg-card">
      <div class="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5">
        <button type="button" class="grid size-10 place-items-center rounded-full border border-hairline hover:bg-app" aria-label="Back" @click="router.back()">
          <ChevronLeft class="size-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="font-serif text-lg font-semibold">Members</h1>
          <p class="truncate text-xs text-ink-muted">{{ academy.active?.academyName }}</p>
        </div>
        <button type="button" class="inline-flex items-center gap-1.5 rounded-full bg-turf-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-turf-700" @click="addOpen = true">
          <UserPlus class="size-3.5" /> Add coach
        </button>
      </div>
      <div class="h-[3px] outfield-stripes" aria-hidden="true" />
    </header>

    <div class="space-y-6 px-4 py-5">
      <p v-if="error" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ error }}</p>
      <LoaderCircle v-if="loading" class="mx-auto size-5 animate-spin text-ink-muted" />
      <section v-for="s in sections" v-else :key="s.title" class="space-y-2">
        <h2 class="text-xs font-semibold tracking-wide text-ink-muted uppercase">{{ s.title }}</h2>
        <p v-if="!s.list.length" class="card p-4 text-center text-sm text-ink-muted">
          {{ s.title === 'Guardians' ? 'Guardians are added from a cadet in the Squad tab.' : 'No coaches yet.' }}
        </p>
        <div v-for="m in s.list" :key="m.userId" class="card p-3">
          <div class="flex items-center gap-3">
            <UiAvatar :name="m.displayName || m.username || '?'" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ m.displayName || m.username }}</p>
              <p class="truncate text-xs text-ink-muted">
                <span v-if="m.username">@{{ m.username }} · </span>
                <span v-if="m.role === 'owner'">Owner</span>
                <span v-else-if="m.status === 'pending'" class="text-cherry">Waiting to accept</span>
                <span v-else-if="m.role === 'coach'">{{ batchCount(m.userId) }} batch{{ batchCount(m.userId) === 1 ? '' : 'es' }}</span>
                <span v-else>Guardian</span>
              </p>
            </div>
            <LoaderCircle v-if="busyId === m.userId" class="size-4 animate-spin text-ink-muted" />
          </div>
          <div v-if="m.role !== 'owner'" class="mt-3 flex flex-wrap gap-2">
            <button v-if="m.role === 'coach' && m.status === 'active'" type="button" :class="chip" @click="openBatches(m)">
              <ListChecks class="size-3.5" /> Batches
            </button>
            <button v-if="m.username" type="button" :class="chip" :disabled="busyId !== null" @click="resetPassword(m)">
              <KeyRound class="size-3.5" /> Reset password
            </button>
            <button
              type="button"
              :disabled="busyId !== null"
              :class="cn(chip, confirmRemoveId === m.userId ? 'border-cherry bg-cherry text-white' : 'text-cherry hover:bg-cherry-soft')"
              @click="remove(m)"
            >
              <Trash2 class="size-3.5" /> {{ confirmRemoveId === m.userId ? 'Tap again to remove' : m.status === 'pending' ? 'Cancel invite' : 'Remove' }}
            </button>
          </div>
          <TemporaryPassword v-if="reset?.userId === m.userId" class="mt-3" :username="reset.username" :password="reset.password" />
        </div>
      </section>
    </div>

    <AddCoachSheet v-if="academy.activeId" v-model:open="addOpen" :academy-id="academy.activeId" @added="load" />
    <CoachBatchesSheet v-model:open="batchesOpen" :coach="batchesFor" :batches="ops.batches" :assigned="assigned" :toggle="toggleBatch" />
  </div>
</template>
