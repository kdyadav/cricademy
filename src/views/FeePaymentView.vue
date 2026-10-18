<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BadgeCheck, Check, CircleAlert, Copy, LoaderCircle, Smartphone } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { feePaymentService, type FeePaymentPreview } from '@/services'
import { formatDueDate, formatInr, upiPayUrl } from '@/lib/fees'

const props = defineProps<{ id: string }>()

const payment = ref<FeePaymentPreview | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const utr = ref('')
const busy = ref(false)
const reportError = ref<string | null>(null)
const reported = ref(false)
const copied = ref(false)

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

onMounted(async () => {
  try {
    payment.value = await feePaymentService.preview(props.id)
    if (!payment.value) loadError.value = 'This payment link is not valid. Check that you opened the full link.'
    else reported.value = payment.value.reported
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load this payment.'
  } finally {
    loading.value = false
  }
})

const links = computed(() => {
  const p = payment.value
  if (!p?.payee) return null
  const note = `${p.title} - ${p.cadetName}`
  return { phonepe: upiPayUrl(p.payee, p.amount, note, props.id, 'phonepe'), upi: upiPayUrl(p.payee, p.amount, note, props.id) }
})

async function copyUpi() {
  if (!payment.value?.payee) return
  await navigator.clipboard.writeText(payment.value.payee.upiId).then(() => (copied.value = true)).catch(() => {})
}

async function report() {
  reportError.value = null
  busy.value = true
  try {
    await feePaymentService.report(props.id, utr.value)
    reported.value = true
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Could not send the payment details.'
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
        <h1 class="font-serif text-2xl font-semibold">Fee payment</h1>
      </div>

      <div v-if="loading" class="flex justify-center py-8"><LoaderCircle class="size-6 animate-spin text-ink-muted" /></div>

      <div v-else-if="loadError || !payment" role="alert" class="flex flex-col items-center gap-2 text-center text-sm text-ink-muted">
        <CircleAlert class="size-8 text-cherry" />
        <p>{{ loadError }}</p>
      </div>

      <template v-else>
        <div class="rounded-xl border border-hairline bg-app p-5 text-center">
          <p class="text-xs font-semibold text-ink-muted">{{ payment.title }} · {{ payment.cadetName }}</p>
          <p class="mt-1 font-serif text-4xl font-semibold tabular-nums">{{ formatInr(payment.amount) }}</p>
          <p class="mt-1 text-xs text-ink-muted">Due {{ formatDueDate(payment.dueDate) }}</p>
          <p v-if="payment.payee" class="mt-2 text-xs">To <span class="font-semibold">{{ payment.payee.payeeName }}</span></p>
        </div>

        <div v-if="payment.status !== 'due'" role="status" class="mt-5 flex flex-col items-center gap-2 text-center text-sm">
          <BadgeCheck class="size-8 text-turf" />
          <p class="font-semibold">{{ payment.status === 'paid' ? 'This fee is paid. Thank you!' : 'The coach has waived this fee.' }}</p>
        </div>

        <p v-else-if="!payment.payee" role="status" class="mt-5 text-center text-sm text-ink-muted">
          The academy hasn't set up UPI payments yet. Please contact the coach.
        </p>

        <template v-else-if="links">
          <div class="mt-5 space-y-2">
            <a :href="links.phonepe" class="flex w-full items-center justify-center gap-2 rounded-full bg-[#5f259f] py-3.5 text-sm font-semibold text-white hover:opacity-90">
              <Smartphone class="size-4" /> Pay with PhonePe
            </a>
            <a :href="links.upi" class="flex w-full items-center justify-center rounded-full border border-hairline py-3 text-sm font-semibold hover:bg-app">
              Other UPI app
            </a>
          </div>
          <p v-if="!isMobile" class="mt-2 text-center text-xs text-ink-muted">Open this link on your phone to pay from your UPI app.</p>
          <button type="button" class="mx-auto mt-3 flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink" @click="copyUpi">
            UPI ID <span class="font-mono font-semibold text-ink">{{ payment.payee.upiId }}</span>
            <Check v-if="copied" class="size-3.5 text-turf" /><Copy v-else class="size-3.5" />
          </button>

          <div v-if="reported" role="status" class="mt-6 rounded-xl bg-mint px-4 py-3 text-center text-sm text-turf-700">
            <p class="font-semibold">Payment details sent</p>
            <p class="mt-0.5 text-xs">The coach will confirm once they see it in their account.</p>
          </div>
          <form v-else class="mt-6 space-y-2 border-t border-hairline pt-5" novalidate @submit.prevent="report">
            <label for="pay-utr" class="block text-sm font-semibold">Paid already?</label>
            <p class="text-xs text-ink-muted">Enter the UPI transaction ID (UTR) from PhonePe → History → this payment.</p>
            <input id="pay-utr" v-model="utr" class="field-input font-mono tabular-nums" inputmode="text" autocomplete="off" maxlength="40" placeholder="e.g. 412345678901" />
            <p v-if="reportError" role="alert" class="text-xs text-cherry">{{ reportError }}</p>
            <button
              type="submit"
              :disabled="busy || !utr.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
            >
              <LoaderCircle v-if="busy" class="size-4 animate-spin" /> I've paid
            </button>
          </form>
        </template>
      </template>
    </div>
  </div>
</template>
