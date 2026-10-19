<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRouter } from 'vue-router'
import { BadgeCheck, CalendarDays, Check, ChevronLeft, CircleAlert, Copy, LoaderCircle, ScanLine, ShieldCheck, Smartphone } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { useAuthStore } from '@/stores/auth'
import { feePaymentService, type FeePaymentPreview } from '@/services'
import { formatDueDate, formatInr, upiPayUrl } from '@/lib/fees'
import { localDate } from '@/stores/ops'
import { cn } from '@/lib/cn'

const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const canGoBack = Boolean(window.history.state?.back) || Boolean(auth.user)

function leave() {
  if (window.history.state?.back) router.back()
  else router.replace('/')
}

const payment = ref<FeePaymentPreview | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const utr = ref('')
const busy = ref(false)
const reportError = ref<string | null>(null)
const reported = ref(false)
const copied = ref(false)

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

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const overdue = computed(() => payment.value?.status === 'due' && payment.value.dueDate < localDate())

const qrSrc = ref<string | null>(null)
watch(
  () => links.value?.upi,
  async (url) => {
    qrSrc.value = url ? await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).catch(() => null) : null
  },
  { immediate: true },
)

async function copyUpi() {
  if (!payment.value?.payee) return
  await navigator.clipboard
    .writeText(payment.value.payee.upiId)
    .then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    })
    .catch(() => {})
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
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-flannel">
    <div class="h-[3px] shrink-0 outfield-stripes" aria-hidden="true" />
    <div class="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4 pb-10">
      <header class="flex items-center gap-3">
        <button
          v-if="canGoBack"
          type="button"
          class="grid size-10 shrink-0 place-items-center rounded-full border border-hairline bg-card text-ink transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          aria-label="Back"
          @click="leave"
        >
          <ChevronLeft class="size-5" />
        </button>
        <AcademyCrest />
        <div class="min-w-0">
          <h1 class="font-serif text-xl leading-tight font-semibold">Fee payment</h1>
          <p class="text-xs text-ink-muted">Secure UPI payment</p>
        </div>
      </header>

      <div v-if="loading" class="flex flex-1 items-center justify-center py-16"><LoaderCircle class="size-6 animate-spin text-ink-muted" /></div>

      <div v-else-if="loadError || !payment" role="alert" class="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center text-sm text-ink-muted shadow-card">
        <span class="grid size-12 place-items-center rounded-full bg-cherry-soft"><CircleAlert class="size-6 text-cherry" /></span>
        <p>{{ loadError }}</p>
      </div>

      <template v-else>
        <section class="mt-6 overflow-hidden rounded-2xl bg-card shadow-card" aria-label="Fee details">
          <div class="px-6 pt-6 pb-5 text-center">
            <p class="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{{ payment.title }}</p>
            <p class="mt-2 font-serif text-5xl font-semibold tracking-tight tabular-nums">{{ formatInr(payment.amount) }}</p>
            <p class="mt-2 text-sm text-ink-muted">for <span class="font-semibold text-ink">{{ payment.cadetName }}</span></p>
          </div>
          <dl class="divide-y divide-hairline border-t border-dashed border-hairline text-sm">
            <div class="flex items-center justify-between gap-3 px-6 py-3">
              <dt class="flex items-center gap-2 text-ink-muted"><CalendarDays class="size-4" /> Due</dt>
              <dd :class="cn('font-semibold', overdue && 'text-cherry')">
                {{ formatDueDate(payment.dueDate) }}
                <span v-if="overdue" class="ml-1.5 rounded-full bg-cherry-soft px-2 py-0.5 text-[11px] font-semibold">Overdue</span>
              </dd>
            </div>
            <div v-if="payment.payee" class="flex items-center justify-between gap-3 px-6 py-3">
              <dt class="flex items-center gap-2 text-ink-muted"><ShieldCheck class="size-4" /> Paid to</dt>
              <dd class="truncate font-semibold">{{ payment.payee.payeeName }}</dd>
            </div>
          </dl>
        </section>

        <div v-if="payment.status !== 'due'" role="status" class="mt-5 flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center shadow-card">
          <span class="grid size-12 place-items-center rounded-full bg-mint"><BadgeCheck class="size-6 text-turf" /></span>
          <p class="font-semibold">{{ payment.status === 'paid' ? 'This fee is paid. Thank you!' : 'The coach has waived this fee.' }}</p>
        </div>

        <p v-else-if="!payment.payee" role="status" class="mt-5 rounded-2xl bg-card p-6 text-center text-sm text-ink-muted shadow-card">
          The academy hasn't set up UPI payments yet. Please contact the coach.
        </p>

        <template v-else-if="links">
          <section class="mt-5 flex flex-col rounded-2xl bg-card p-5 shadow-card" aria-label="Pay">
            <div :class="cn('space-y-2.5', !isMobile && 'order-2 mt-5')">
              <a
                :href="links.phonepe"
                class="flex w-full items-center justify-center gap-2 rounded-full bg-[#5f259f] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#5f259f]/40 focus-visible:outline-none"
              >
                <Smartphone class="size-4" /> Pay with PhonePe
              </a>
              <a
                :href="links.upi"
                class="flex w-full items-center justify-center rounded-full border border-hairline py-3 text-sm font-semibold transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
              >
                Other UPI app
              </a>
            </div>

            <div v-if="qrSrc" :class="cn('flex items-center gap-3', isMobile ? 'mt-5' : 'order-1')">
              <span class="h-px flex-1 bg-hairline" />
              <span class="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{{ isMobile ? 'or scan' : 'Scan to pay' }}</span>
              <span class="h-px flex-1 bg-hairline" />
            </div>
            <figure v-if="qrSrc" :class="cn('mt-4 flex flex-col items-center', !isMobile && 'order-1')">
              <img
                :src="qrSrc"
                :alt="`UPI QR code to pay ${formatInr(payment.amount)} to ${payment.payee.payeeName}`"
                class="size-36 rounded-xl border border-hairline bg-white p-2"
              />
              <figcaption class="mt-2.5 flex items-center gap-1.5 text-xs text-ink-muted">
                <ScanLine class="size-3.5" /> Works with any UPI app
              </figcaption>
            </figure>

            <button
              type="button"
              :class="
                cn(
                  'mx-auto mt-4 flex max-w-full items-center gap-2 rounded-full bg-app px-3.5 py-1.5 text-xs text-ink-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none',
                  !isMobile && 'order-1',
                )
              "
              :aria-label="`Copy UPI ID ${payment.payee.upiId}`"
              @click="copyUpi"
            >
              UPI ID <span class="truncate font-mono font-semibold text-ink">{{ payment.payee.upiId }}</span>
              <Check v-if="copied" class="size-3.5 shrink-0 text-turf" /><Copy v-else class="size-3.5 shrink-0" />
            </button>
            <span class="sr-only" aria-live="polite">{{ copied ? 'UPI ID copied' : '' }}</span>
          </section>

          <div v-if="reported" role="status" class="mt-5 flex items-start gap-3 rounded-2xl bg-mint px-5 py-4 text-sm text-turf-700">
            <BadgeCheck class="mt-0.5 size-5 shrink-0" />
            <div>
              <p class="font-semibold">Payment details sent</p>
              <p class="mt-0.5 text-xs">The coach will confirm once they see it in their account.</p>
            </div>
          </div>
          <form v-else class="mt-5 space-y-2.5 rounded-2xl bg-card p-5 shadow-card" novalidate @submit.prevent="report">
            <label for="pay-utr" class="block text-sm font-semibold">Paid already?</label>
            <p class="text-xs leading-relaxed text-ink-muted">Enter the UPI transaction ID (UTR) from your UPI app's history for this payment.</p>
            <input id="pay-utr" v-model="utr" class="field-input font-mono tabular-nums" inputmode="text" autocomplete="off" maxlength="40" placeholder="e.g. 412345678901" />
            <p v-if="reportError" role="alert" class="text-xs text-cherry">{{ reportError }}</p>
            <button
              type="submit"
              :disabled="busy || !utr.trim()"
              class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white transition hover:bg-turf-700 disabled:opacity-60"
            >
              <LoaderCircle v-if="busy" class="size-4 animate-spin" /> I've paid
            </button>
          </form>
        </template>
      </template>
    </div>
  </div>
</template>
