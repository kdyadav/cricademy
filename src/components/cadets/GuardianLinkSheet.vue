<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { BadgeCheck, Clock, KeyRound, LoaderCircle, Mail, MessageCircle, Pencil, ShieldCheck, Trash2, UserPen, X } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import TemporaryPassword from '@/components/members/TemporaryPassword.vue'
import GuardianInviteForm from './GuardianInviteForm.vue'
import { useCadetsStore } from '@/stores/cadets'
import { useAcademyStore } from '@/stores/academy'
import { membershipService } from '@/services'
import { isEmailContact, type GuardianInviteFormInput } from '@/schemas/guardian'
import { LINK_STATUS_LABELS, PERMISSION_OPTIONS } from '@/data/options'
import { formatDuration, minutesUntil } from '@/lib/time'
import { cn } from '@/lib/cn'

const props = defineProps<{ cadetId: string | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ editCadet: [] }>()

const store = useCadetsStore()
const academy = useAcademyStore()
const cadet = computed(() => (props.cadetId ? store.byId(props.cadetId) : null))
const busy = computed(() => !!cadet.value && (store.busyId === cadet.value.id || resetting.value))
const editing = ref(false)
const confirmUnlink = ref(false)
const resetting = ref(false)
const resetPassword = ref<string | null>(null)

watch([open, () => props.cadetId], () => {
  editing.value = false
  confirmUnlink.value = false
  resetPassword.value = null
  store.error = null
  store.lastAdded = null
})

const added = computed(() => (cadet.value && store.lastAdded?.cadetId === cadet.value.id ? store.lastAdded : null))

async function reset() {
  const c = cadet.value
  if (!c?.guardianUserId || !academy.activeId) return
  resetting.value = true
  store.error = null
  try {
    resetPassword.value = await membershipService.resetPassword(academy.activeId, c.guardianUserId)
  } catch (e) {
    store.error = e instanceof Error && e.message ? e.message : 'Could not reset the password.'
  } finally {
    resetting.value = false
  }
}

const showForm = computed(() => cadet.value?.linkStatus === 'unlinked' || editing.value)
const expiresIn = computed(() => (cadet.value?.inviteExpiresAt ? minutesUntil(cadet.value.inviteExpiresAt) : null))
const permissionLabels = computed(() =>
  PERMISSION_OPTIONS.filter((p) => cadet.value?.guardian?.permissions.includes(p.value)).map((p) => p.label),
)

async function send(input: GuardianInviteFormInput) {
  if (!cadet.value || !academy.activeId) return
  resetPassword.value = null
  await store.addGuardian(academy.activeId, cadet.value.id, input).then(() => (editing.value = false)).catch(() => {})
}

async function unlink() {
  if (!cadet.value) return
  if (!confirmUnlink.value) return void (confirmUnlink.value = true)
  resetPassword.value = null
  await store.unlink(cadet.value.id).catch(() => {})
  confirmUnlink.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-float focus:outline-none"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" aria-hidden="true" />
        <template v-if="cadet">
          <div class="flex items-center gap-3">
            <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="lg" />
            <div class="min-w-0 flex-1">
              <DialogTitle class="truncate font-serif text-xl font-semibold">{{ cadet.name }}</DialogTitle>
              <DialogDescription class="text-xs text-ink-muted">
                #{{ cadet.jersey }} · {{ cadet.ageGroup }} {{ cadet.role }} · {{ LINK_STATUS_LABELS[cadet.linkStatus] }}
              </DialogDescription>
            </div>
            <button type="button" class="grid size-9 place-items-center rounded-full hover:bg-app" aria-label="Edit cadet details" @click="emit('editCadet')">
              <UserPen class="size-4" />
            </button>
            <button type="button" class="grid size-9 place-items-center rounded-full hover:bg-app" aria-label="Close" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <p v-if="store.error" role="alert" class="mt-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ store.error }}</p>

          <div v-if="added" role="status" class="mt-3">
            <TemporaryPassword v-if="added.member?.temporaryPassword" :username="added.member.username" :password="added.member.temporaryPassword" />
            <p v-else-if="added.member?.status === 'pending'" class="rounded-lg bg-gold-soft px-3 py-2.5 text-xs text-clay">
              <span class="font-semibold">{{ added.member.username }}</span> already has an account. They'll see the invitation when they sign in
              and must accept it before they can see {{ cadet.name }}.
            </p>
            <p v-else-if="added.member" class="rounded-lg bg-mint px-3 py-2.5 text-xs text-turf-700">
              <span class="font-semibold">{{ added.member.username }}</span> is now linked with {{ cadet.name }}.
            </p>
            <p v-else class="rounded-lg bg-gold-soft px-3 py-2.5 text-xs text-clay">Demo mode saves the guardian but cannot create accounts.</p>
          </div>
          <TemporaryPassword
            v-if="resetPassword && cadet.guardian?.username"
            class="mt-3"
            :username="cadet.guardian.username"
            :password="resetPassword"
          />

          <div v-if="showForm" class="mt-5">
            <p class="mb-3 text-sm text-ink-muted">
              {{ editing ? 'Update the guardian details.' : 'Add a parent or guardian by username to link with this cadet.' }}
            </p>
            <GuardianInviteForm
              :key="cadet.id"
              :initial="editing ? cadet.guardian : undefined"
              :submitting="busy"
              @submit="send"
              @cancel="editing ? (editing = false) : (open = false)"
            />
          </div>

          <div v-else-if="cadet.guardian" class="mt-5 space-y-4">
            <div class="card p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="flex items-center gap-1.5 text-sm font-semibold">
                    {{ cadet.guardian.name }}
                    <BadgeCheck v-if="cadet.guardian.verified" class="size-4 text-turf" aria-label="Verified" />
                  </p>
                  <p class="text-xs text-ink-muted">
                    <span v-if="cadet.guardian.username">@{{ cadet.guardian.username }} · </span>{{ cadet.guardian.relationship }}
                  </p>
                </div>
                <span
                  :class="
                    cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                      cadet.linkStatus === 'linked' ? 'bg-mint text-turf-700' : 'bg-gold-soft text-clay',
                    )
                  "
                >
                  {{ LINK_STATUS_LABELS[cadet.linkStatus] }}
                </span>
              </div>
              <p class="mt-3 flex items-center gap-1.5 text-xs text-ink">
                <Mail v-if="isEmailContact(cadet.guardian.contact)" class="size-3.5 text-ink-muted" />
                <MessageCircle v-else class="size-3.5 text-ink-muted" />
                {{ cadet.guardian.contact }}
              </p>
              <p class="mt-1.5 flex items-start gap-1.5 text-xs text-ink">
                <ShieldCheck class="mt-px size-3.5 shrink-0 text-ink-muted" /> {{ permissionLabels.join(' · ') }}
              </p>
              <p v-if="cadet.linkStatus === 'pending'" :class="cn('mt-1.5 flex items-center gap-1.5 text-xs font-semibold', expiresIn === null || expiresIn > 0 ? 'text-clay' : 'text-cherry')">
                <Clock class="size-3.5" />
                <template v-if="expiresIn === null">Waiting for them to accept in the app</template>
                <template v-else>{{ expiresIn > 0 ? `Invite expires in ${formatDuration(expiresIn)}` : 'Invite expired' }}</template>
              </p>
            </div>

            <div class="flex gap-2">
              <button
                v-if="cadet.linkStatus === 'linked' && cadet.guardian.username && cadet.guardianUserId"
                type="button"
                :disabled="busy"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app disabled:opacity-60"
                @click="reset"
              >
                <LoaderCircle v-if="resetting" class="size-4 animate-spin" />
                <KeyRound v-else class="size-4" /> Reset password
              </button>
              <button
                type="button"
                :disabled="busy"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app"
                @click="editing = true"
              >
                <Pencil class="size-4" /> Edit details
              </button>
            </div>

            <button
              type="button"
              :disabled="busy"
              :class="
                cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold transition disabled:opacity-60',
                  confirmUnlink ? 'bg-cherry text-white' : 'text-cherry hover:bg-cherry-soft',
                )
              "
              @click="unlink"
            >
              <Trash2 class="size-4" />
              <template v-if="confirmUnlink">Tap again to confirm</template>
              <template v-else>{{ cadet.linkStatus === 'pending' ? 'Cancel invite' : 'Remove guardian' }}</template>
            </button>
          </div>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
