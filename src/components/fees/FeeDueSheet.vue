<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BadgeCheck, Check, Copy, LoaderCircle, Mail, MessageCircle, RotateCcw, Trash2 } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ChoiceGroup from '@/components/ui/ChoiceGroup.vue'
import { useCadetsStore } from '@/stores/cadets'
import { useFeesStore } from '@/stores/fees'
import { isEmailContact } from '@/schemas/guardian'
import { formatDueDate, formatInr, isOverdue, payLink, whatsappNumber } from '@/lib/fees'
import { cn } from '@/lib/cn'
import type { PaymentMethod } from '@/types'

const props = defineProps<{ dueId: string | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ setup: [] }>()

const fees = useFeesStore()
const cadets = useCadetsStore()
const due = computed(() => (props.dueId ? fees.byId(props.dueId) : null))
const cadet = computed(() => (due.value ? cadets.byId(due.value.cadetId) : null))
const overdue = computed(() => !!due.value && isOverdue(due.value, fees.today))

const METHODS = { UPI: 'upi', Cash: 'cash', Other: 'other' } as const satisfies Record<string, PaymentMethod>
const METHOD_LABEL: Record<PaymentMethod, string> = { upi: 'UPI', cash: 'Cash', other: 'Other' }
const method = ref<keyof typeof METHODS>('UPI')
const reference = ref('')
const busy = ref(false)
const failure = ref<string | null>(null)
const confirmDelete = ref(false)
const copied = ref(false)

watch([open, () => props.dueId], () => {
  method.value = 'UPI'
  reference.value = due.value?.reportedReference ?? ''
  failure.value = null
  confirmDelete.value = false
  copied.value = false
})

const link = computed(() => (due.value ? payLink(due.value.id) : ''))
const guardian = computed(() => cadet.value?.guardian ?? null)
const remindHref = computed(() => {
  const d = due.value
  const g = guardian.value
  if (!d || !g || !cadet.value) return null
  const when = overdue.value ? 'was due on' : 'is due on'
  const text = `Hello ${g.name}, ${d.title} of ${formatInr(d.amount)} for ${cadet.value.name} ${when} ${formatDueDate(d.dueDate)}. Pay with PhonePe or any UPI app: ${link.value}`
  if (isEmailContact(g.contact)) return `mailto:${g.contact}?subject=${encodeURIComponent(`${d.title} for ${cadet.value.name}`)}&body=${encodeURIComponent(text)}`
  return `https://wa.me/${whatsappNumber(g.contact)}?text=${encodeURIComponent(text)}`
})

async function attempt(action: () => Promise<unknown>, fallback: string, close = true) {
  busy.value = true
  failure.value = null
  try {
    await action()
    if (close) open.value = false
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : fallback
  } finally {
    busy.value = false
  }
}

const recordPayment = () =>
  attempt(() => fees.markPaid(due.value!.id, { method: METHODS[method.value], reference: reference.value }), 'Could not record the payment.')
const confirmReported = () =>
  attempt(() => fees.markPaid(due.value!.id, { method: 'upi', reference: due.value!.reportedReference }), 'Could not record the payment.')
const setStatus = (status: 'due' | 'waived') => attempt(() => fees.setStatus(due.value!.id, status), 'Could not update the fee.')
const reminded = () => fees.markReminded(due.value!.id).catch(() => {})

async function copyLink() {
  await navigator.clipboard.writeText(link.value).then(() => (copied.value = true)).catch(() => {})
}

function remove() {
  if (!confirmDelete.value) return void (confirmDelete.value = true)
  return attempt(() => fees.remove(due.value!.id), 'Could not delete the fee.')
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="due?.title ?? 'Fee'" :description="cadet ? `${cadet.name} · #${cadet.jersey}` : undefined">
    <template v-if="due">
      <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>

      <div class="flex items-end justify-between rounded-xl bg-app px-4 py-3">
        <div>
          <p class="font-serif text-3xl leading-none font-semibold tabular-nums">{{ formatInr(due.amount) }}</p>
          <p class="mt-1 text-xs text-ink-muted">Due {{ formatDueDate(due.dueDate) }}</p>
        </div>
        <span
          :class="
            cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              due.status === 'paid' ? 'bg-mint text-turf-700' : due.status === 'waived' ? 'bg-card text-ink-muted' : overdue ? 'bg-cherry-soft text-cherry' : 'bg-gold-soft text-clay',
            )
          "
        >
          {{ due.status === 'paid' ? 'Paid' : due.status === 'waived' ? 'Waived' : overdue ? 'Overdue' : 'Due' }}
        </span>
      </div>

      <p v-if="due.status === 'paid'" class="mt-3 flex items-center gap-1.5 text-xs text-turf-700">
        <BadgeCheck class="size-4" /> {{ METHOD_LABEL[due.method ?? 'other'] }}
        <template v-if="due.paidAt"> · {{ new Date(due.paidAt).toLocaleDateString('en-IN') }}</template>
        <template v-if="due.reference"> · Ref {{ due.reference }}</template>
      </p>

      <template v-if="due.status === 'due'">
        <div v-if="due.reportedReference" role="status" class="mt-3 rounded-lg bg-gold-soft px-3 py-2.5 text-xs text-clay">
          <p class="font-semibold">Parent says they paid · UTR {{ due.reportedReference }}</p>
          <p class="mt-0.5">Find this UTR in your PhonePe or bank app before confirming.</p>
          <button
            type="button"
            :disabled="busy"
            class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-turf-900 py-2 font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
            @click="confirmReported"
          >
            <Check class="size-3.5" /> Confirm payment received
          </button>
        </div>

        <section class="mt-4">
          <h3 class="mb-1.5 text-xs font-semibold text-ink-muted">Ask for payment</h3>
          <p v-if="!fees.settings" class="rounded-lg bg-app px-3 py-2 text-xs text-ink-muted">
            <button type="button" class="font-semibold text-turf hover:underline" @click="emit('setup')">Add your UPI ID</button>
            so parents can pay with PhonePe.
          </p>
          <div v-else class="flex gap-2">
            <button type="button" class="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline py-2 text-xs font-semibold hover:bg-app" @click="copyLink">
              <Check v-if="copied" class="size-3.5" /><Copy v-else class="size-3.5" /> {{ copied ? 'Copied' : 'Copy pay link' }}
            </button>
            <a
              v-if="remindHref"
              :href="remindHref"
              target="_blank"
              rel="noopener"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-turf-900 py-2 text-xs font-semibold text-white hover:bg-turf-700"
              @click="reminded"
            >
              <Mail v-if="isEmailContact(guardian!.contact)" class="size-3.5" /><MessageCircle v-else class="size-3.5" /> Remind {{ guardian!.name.split(' ')[0] }}
            </a>
          </div>
          <p v-if="fees.settings && !guardian" class="mt-1.5 text-[11px] text-ink-muted">Add a guardian to this cadet to send reminders.</p>
          <p v-if="due.remindedAt" class="mt-1.5 text-[11px] text-ink-muted">Last reminded {{ new Date(due.remindedAt).toLocaleDateString('en-IN') }}</p>
        </section>

        <section class="mt-4 space-y-2.5">
          <ChoiceGroup v-model="method" legend="Record payment" :options="Object.keys(METHODS) as (keyof typeof METHODS)[]" />
          <input v-model="reference" class="field-input py-2.5 text-sm" maxlength="60" :placeholder="method === 'UPI' ? 'UTR / transaction ID (optional)' : 'Receipt or note (optional)'" />
          <button
            type="button"
            :disabled="busy"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
            @click="recordPayment"
          >
            <LoaderCircle v-if="busy" class="size-4 animate-spin" /><BadgeCheck v-else class="size-4" /> Mark as paid
          </button>
        </section>
      </template>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          :disabled="busy"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-ink-muted hover:bg-app disabled:opacity-60"
          @click="setStatus(due.status === 'due' ? 'waived' : 'due')"
        >
          <RotateCcw v-if="due.status !== 'due'" class="size-3.5" /> {{ due.status === 'due' ? 'Waive fee' : 'Reopen as due' }}
        </button>
        <button
          type="button"
          :disabled="busy"
          :class="cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition disabled:opacity-60', confirmDelete ? 'bg-cherry text-white' : 'text-cherry hover:bg-cherry-soft')"
          @click="remove"
        >
          <Trash2 class="size-3.5" /> {{ confirmDelete ? 'Tap again to delete' : 'Delete' }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>
