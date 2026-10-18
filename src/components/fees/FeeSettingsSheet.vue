<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, Save } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeesStore } from '@/stores/fees'
import { feeSettingsSchema, type FeeSettingsFormInput } from '@/schemas/fees'
import { ACADEMY } from '@/data/mock'

const open = defineModel<boolean>('open', { required: true })

const auth = useAuthStore()
const fees = useFeesStore()
const busy = ref(false)
const failure = ref<string | null>(null)

const { handleSubmit, defineField, errors, submitCount, resetForm } = useForm({ validationSchema: toTypedSchema(feeSettingsSchema) })
const [upiId] = defineField('upiId')
const [payeeName] = defineField('payeeName')
const err = (k: keyof FeeSettingsFormInput) => (submitCount.value > 0 ? errors.value[k] : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  resetForm({ values: { upiId: fees.settings?.upiId ?? '', payeeName: fees.settings?.payeeName ?? ACADEMY.name } })
})

const onSubmit = handleSubmit(async (input) => {
  busy.value = true
  failure.value = null
  try {
    await fees.saveSettings(auth.user!.id, input)
    open.value = false
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : 'Could not save payment settings.'
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <BottomSheet v-model:open="open" title="Payment settings" description="Parents pay this UPI ID from PhonePe or any UPI app.">
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="fee-upi" class="mb-1 block text-xs font-semibold text-ink-muted">UPI ID</label>
        <input
          id="fee-upi"
          v-model="upiId"
          class="field-input"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="e.g. apexacademy@ybl"
          :aria-invalid="!!err('upiId')"
        />
        <p v-if="err('upiId')" class="mt-1 text-xs text-cherry">{{ err('upiId') }}</p>
        <p class="mt-1 text-[11px] text-ink-muted">
          Find it in PhonePe under your profile → UPI ID. A PhonePe Business UPI ID avoids the limits banks place on payments to personal UPI IDs.
        </p>
      </div>
      <div>
        <label for="fee-payee" class="mb-1 block text-xs font-semibold text-ink-muted">Payee name</label>
        <input id="fee-payee" v-model="payeeName" class="field-input" :aria-invalid="!!err('payeeName')" />
        <p v-if="err('payeeName')" class="mt-1 text-xs text-cherry">{{ err('payeeName') }}</p>
      </div>
      <button
        type="submit"
        :disabled="busy"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        Save
      </button>
    </form>
  </BottomSheet>
</template>
