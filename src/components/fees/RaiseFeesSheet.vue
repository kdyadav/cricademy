<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, ReceiptIndianRupee } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { useFeesStore } from '@/stores/fees'
import { localDate, useOpsStore } from '@/stores/ops'
import { raiseFeesSchema, type RaiseFeesFormInput } from '@/schemas/fees'
import { formatInr } from '@/lib/fees'

const open = defineModel<boolean>('open', { required: true })

const auth = useAuthStore()
const cadets = useCadetsStore()
const ops = useOpsStore()
const fees = useFeesStore()
const busy = ref(false)
const failure = ref<string | null>(null)

const { handleSubmit, defineField, errors, submitCount, resetForm, values } = useForm({ validationSchema: toTypedSchema(raiseFeesSchema) })
const [title] = defineField('title')
const [amount] = defineField('amount')
const [dueDate] = defineField('dueDate')
const [target] = defineField('target')
const err = (k: keyof RaiseFeesFormInput) => (submitCount.value > 0 ? errors.value[k] : undefined)

const payers = computed(() => (values.target === 'all' ? cadets.cadets : cadets.cadets.filter((c) => c.batchId === values.target)))
const total = computed(() => (Number(values.amount) > 0 ? Number(values.amount) * payers.value.length : 0))

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth(), 10)
  if (due < now) due.setMonth(due.getMonth() + 1)
  resetForm({
    values: {
      title: `${due.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} fees`,
      amount: undefined,
      dueDate: localDate(due),
      target: 'all',
    },
  })
})

const onSubmit = handleSubmit(async ({ title, amount, dueDate }) => {
  if (!payers.value.length) return void (failure.value = 'No cadets to charge in this group.')
  busy.value = true
  failure.value = null
  try {
    await fees.raise(auth.user!.id, payers.value.map((c) => c.id), { title, amount, dueDate })
    open.value = false
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : 'Could not raise the fees.'
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <BottomSheet v-model:open="open" title="Raise fees" description="Adds a due to each cadet in the group.">
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="fee-title" class="mb-1 block text-xs font-semibold text-ink-muted">Fee name</label>
        <input id="fee-title" v-model="title" class="field-input" :aria-invalid="!!err('title')" />
        <p v-if="err('title')" class="mt-1 text-xs text-cherry">{{ err('title') }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="fee-amount" class="mb-1 block text-xs font-semibold text-ink-muted">Amount per cadet (₹)</label>
          <input id="fee-amount" v-model="amount" type="number" inputmode="decimal" min="1" step="any" class="field-input tabular-nums" :aria-invalid="!!err('amount')" />
          <p v-if="err('amount')" class="mt-1 text-xs text-cherry">{{ err('amount') }}</p>
        </div>
        <div>
          <label for="fee-due" class="mb-1 block text-xs font-semibold text-ink-muted">Due date</label>
          <input id="fee-due" v-model="dueDate" type="date" class="field-input tabular-nums" :aria-invalid="!!err('dueDate')" />
          <p v-if="err('dueDate')" class="mt-1 text-xs text-cherry">{{ err('dueDate') }}</p>
        </div>
      </div>
      <div>
        <label for="fee-target" class="mb-1 block text-xs font-semibold text-ink-muted">Charge</label>
        <select id="fee-target" v-model="target" class="field-input">
          <option value="all">Whole squad</option>
          <option v-for="b in ops.batches" :key="b.id" :value="b.id">{{ b.label }}</option>
        </select>
        <p v-if="err('target')" class="mt-1 text-xs text-cherry">{{ err('target') }}</p>
      </div>
      <p class="rounded-lg bg-app px-3 py-2 text-xs text-ink-muted">
        {{ payers.length }} cadet{{ payers.length === 1 ? '' : 's' }}<template v-if="total"> · {{ formatInr(total) }} in total</template>
      </p>
      <button
        type="submit"
        :disabled="busy"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <ReceiptIndianRupee v-else class="size-4" />
        Raise fees
      </button>
    </form>
  </BottomSheet>
</template>
