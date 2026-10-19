<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, Save } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useAcademyStore } from '@/stores/academy'
import { academyNameSchema } from '@/schemas/academy'

const open = defineModel<boolean>('open', { required: true })

const academy = useAcademyStore()
const busy = ref(false)
const failure = ref<string | null>(null)

const { handleSubmit, defineField, errors, submitCount, resetForm } = useForm({ validationSchema: toTypedSchema(academyNameSchema) })
const [name] = defineField('name')
const err = () => (submitCount.value > 0 ? errors.value.name : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  resetForm({ values: { name: academy.active?.academyName ?? '' } })
})

const onSubmit = handleSubmit(async (input) => {
  busy.value = true
  failure.value = null
  try {
    await academy.rename(academy.activeId!, input.name)
    open.value = false
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : 'Could not rename the academy.'
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <BottomSheet v-model:open="open" title="Rename academy" description="Coaches and guardians will see the new name.">
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="academy-name" class="mb-1 block text-xs font-semibold text-ink-muted">Academy name</label>
        <input id="academy-name" v-model="name" class="field-input" autocomplete="off" :aria-invalid="!!err()" />
        <p v-if="err()" class="mt-1 text-xs text-cherry">{{ err() }}</p>
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
