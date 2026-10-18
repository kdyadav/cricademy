<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import {
  BadgeCheck,
  Check,
  Clock,
  Copy,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pencil,
  RotateCw,
  Send,
  ShieldCheck,
  Trash2,
  UserPen,
  X,
} from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import GuardianInviteForm from './GuardianInviteForm.vue'
import { useCadetsStore } from '@/stores/cadets'
import { isEmailContact, type GuardianInviteFormInput } from '@/schemas/guardian'
import { LINK_STATUS_LABELS, PERMISSION_OPTIONS } from '@/data/options'
import { formatDuration, minutesUntil } from '@/lib/time'
import { cn } from '@/lib/cn'

const props = defineProps<{ cadetId: string | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ editCadet: [] }>()

const store = useCadetsStore()
const cadet = computed(() => (props.cadetId ? store.byId(props.cadetId) : null))
const busy = computed(() => !!cadet.value && store.busyId === cadet.value.id)
const editing = ref(false)
const confirmUnlink = ref(false)

watch([open, () => props.cadetId], () => {
  editing.value = false
  confirmUnlink.value = false
  copied.value = false
  store.error = null
  store.delivery = null
})

const copied = ref(false)
const delivery = computed(() => (cadet.value && store.delivery?.cadetId === cadet.value.id ? store.delivery : null))

/** Opens the coach's own WhatsApp or mail app with the invite link prefilled. */
const shareHref = computed(() => {
  const c = cadet.value
  const link = delivery.value?.link
  if (!c?.guardian || !link) return null
  const text = `Hello ${c.guardian.name}, please use this link to link your account with ${c.name} on Cricademy: ${link}`
  if (isEmailContact(c.guardian.contact)) {
    return `mailto:${c.guardian.contact}?subject=${encodeURIComponent(`Link your account with ${c.name}`)}&body=${encodeURIComponent(text)}`
  }
  let digits = c.guardian.contact.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
})

async function copyLink() {
  if (!delivery.value?.link) return
  await navigator.clipboard.writeText(delivery.value.link).then(() => (copied.value = true)).catch(() => {})
}

const showForm = computed(() => cadet.value?.linkStatus === 'unlinked' || editing.value)
const expiresIn = computed(() => (cadet.value?.inviteExpiresAt ? minutesUntil(cadet.value.inviteExpiresAt) : null))
const permissionLabels = computed(() =>
  PERMISSION_OPTIONS.filter((p) => cadet.value?.guardian?.permissions.includes(p.value)).map((p) => p.label),
)

async function send(input: GuardianInviteFormInput) {
  if (!cadet.value) return
  await store.sendInvite(cadet.value.id, input).then(() => (editing.value = false)).catch(() => {})
}

async function resend() {
  if (cadet.value) await store.resendInvite(cadet.value.id).catch(() => {})
}

async function unlink() {
  if (!cadet.value) return
  if (!confirmUnlink.value) return void (confirmUnlink.value = true)
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

          <div
            v-if="delivery"
            role="status"
            :class="cn('mt-3 rounded-lg px-3 py-2.5 text-xs', delivery.status === 'sent' ? 'bg-mint text-turf-700' : 'bg-gold-soft text-clay')"
          >
            <p v-if="delivery.status === 'sent'" class="flex items-center gap-1.5 font-semibold">
              <Check class="size-4" /> Invite sent on WhatsApp to {{ cadet.guardian?.contact }}
            </p>
            <p v-else>{{ delivery.reason }}</p>
            <template v-if="delivery.link">
              <p class="mt-1.5 truncate font-mono text-[11px] text-ink">{{ delivery.link }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline bg-card py-2 font-semibold text-ink hover:bg-app"
                  @click="copyLink"
                >
                  <Check v-if="copied" class="size-3.5" /><Copy v-else class="size-3.5" /> {{ copied ? 'Copied' : 'Copy link' }}
                </button>
                <a
                  v-if="shareHref && delivery.status === 'manual'"
                  :href="shareHref"
                  target="_blank"
                  rel="noopener"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-turf-900 py-2 font-semibold text-white hover:bg-turf-700"
                >
                  <Send class="size-3.5" /> {{ isEmailContact(cadet.guardian?.contact ?? '') ? 'Open email' : 'Open WhatsApp' }}
                </a>
              </div>
            </template>
          </div>

          <div v-if="showForm" class="mt-5">
            <p class="mb-3 text-sm text-ink-muted">
              {{ editing ? 'Update the details and send a fresh invite.' : 'Invite a parent or guardian to link with this cadet.' }}
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
                  <p class="text-xs text-ink-muted">{{ cadet.guardian.relationship }}</p>
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
              <p
                v-if="cadet.linkStatus === 'pending' && expiresIn !== null"
                :class="cn('mt-1.5 flex items-center gap-1.5 text-xs font-semibold', expiresIn > 0 ? 'text-clay' : 'text-cherry')"
              >
                <Clock class="size-3.5" />
                {{ expiresIn > 0 ? `Invite expires in ${formatDuration(expiresIn)}` : 'Invite expired' }}
              </p>
            </div>

            <div v-if="cadet.linkStatus === 'pending'" class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :disabled="busy"
                class="flex items-center justify-center gap-1.5 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
                @click="resend"
              >
                <LoaderCircle v-if="busy" class="size-4 animate-spin" />
                <RotateCw v-else class="size-4" /> Resend
              </button>
              <button
                type="button"
                :disabled="busy"
                class="flex items-center justify-center gap-1.5 rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app"
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
