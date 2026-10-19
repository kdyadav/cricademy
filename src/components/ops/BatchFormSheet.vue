<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, Save, Trash2 } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ChoiceGroup from '@/components/ui/ChoiceGroup.vue'
import { useAcademyStore } from '@/stores/academy'
import { useCoachStore } from '@/stores/coach'
import { useOpsStore } from '@/stores/ops'
import { netBatchSchema, type NetBatchFormInput } from '@/schemas/academy'
import { AGE_GROUP_OPTIONS } from '@/data/options'
import type { NetBatch } from '@/types'
import { cn } from '@/lib/cn'

const props = defineProps<{ batch: NetBatch | null }>()
const open = defineModel<boolean>('open', { required: true })

const academy = useAcademyStore()
const coach = useCoachStore()
const ops = useOpsStore()
const busy = ref(false)
const failure = ref<string | null>(null)
const confirmDelete = ref(false)

const { handleSubmit, defineField, errors, submitCount, resetForm } = useForm({
  validationSchema: toTypedSchema(netBatchSchema),
})
const [label] = defineField('label')
const [ageGroup] = defineField('ageGroup')
const [focus] = defineField('focus')
const [start] = defineField('start')
const [end] = defineField('end')
const [pitch] = defineField('pitch')
const err = (path: keyof NetBatchFormInput) => (submitCount.value > 0 ? errors.value[path] : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  confirmDelete.value = false
  const b = props.batch
  resetForm({
    values: b
      ? { label: b.label, ageGroup: b.ageGroup, focus: b.focus, start: b.start, end: b.end, pitch: b.pitch }
      : { label: '', ageGroup: undefined, focus: '', start: '16:00', end: '18:00', pitch: coach.profile?.pitch ?? '' },
  })
})

async function attempt(action: () => Promise<unknown>, fallback: string) {
  busy.value = true
  failure.value = null
  try {
    await action()
    open.value = false
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : fallback
  } finally {
    busy.value = false
  }
}

const onSubmit = handleSubmit((input) =>
  attempt(() => ops.saveBatch(academy.activeId!, input, props.batch?.id), 'Could not save the batch.'),
)

function remove() {
  if (!props.batch) return
  if (!confirmDelete.value) return void (confirmDelete.value = true)
  const id = props.batch.id
  return attempt(() => ops.deleteBatch(id), 'Could not delete the batch.')
}
</script>

<template>
  <BottomSheet
    v-model:open="open"
    :title="batch ? 'Edit batch' : 'New batch'"
    :description="batch ? 'Changes apply to Daily Ops and Nets.' : 'Cadets can be assigned to it from the Squad tab.'"
  >
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="b-label" class="mb-1 block text-xs font-semibold text-ink-muted">Batch name</label>
        <input id="b-label" v-model="label" class="field-input" placeholder="e.g. U-16 Morning Pace Nets" :aria-invalid="!!err('label')" />
        <p v-if="err('label')" class="mt-1 text-xs text-cherry">{{ err('label') }}</p>
      </div>
      <ChoiceGroup v-model="ageGroup" legend="Age group" :options="AGE_GROUP_OPTIONS" :error="err('ageGroup')" />
      <div>
        <label for="b-focus" class="mb-1 block text-xs font-semibold text-ink-muted">Focus</label>
        <input id="b-focus" v-model="focus" class="field-input" placeholder="e.g. Spin craft & ground fielding" />
        <p v-if="err('focus')" class="mt-1 text-xs text-cherry">{{ err('focus') }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="b-start" class="mb-1 block text-xs font-semibold text-ink-muted">Starts</label>
          <input id="b-start" v-model="start" type="time" class="field-input" :aria-invalid="!!err('start')" />
          <p v-if="err('start')" class="mt-1 text-xs text-cherry">{{ err('start') }}</p>
        </div>
        <div>
          <label for="b-end" class="mb-1 block text-xs font-semibold text-ink-muted">Ends</label>
          <input id="b-end" v-model="end" type="time" class="field-input" :aria-invalid="!!err('end')" />
          <p v-if="err('end')" class="mt-1 text-xs text-cherry">{{ err('end') }}</p>
        </div>
      </div>
      <div>
        <label for="b-pitch" class="mb-1 block text-xs font-semibold text-ink-muted">Pitch or net</label>
        <input id="b-pitch" v-model="pitch" class="field-input" placeholder="e.g. Turf Pitch 3" />
        <p v-if="err('pitch')" class="mt-1 text-xs text-cherry">{{ err('pitch') }}</p>
      </div>

      <button
        type="submit"
        :disabled="busy"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ batch ? 'Save changes' : 'Add batch' }}
      </button>
      <button
        v-if="batch && academy.isOwner"
        type="button"
        :disabled="busy"
        :class="
          cn(
            'flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold transition disabled:opacity-60',
            confirmDelete ? 'bg-cherry text-white' : 'text-cherry hover:bg-cherry-soft',
          )
        "
        @click="remove"
      >
        <Trash2 class="size-4" />
        {{ confirmDelete ? 'Tap again to delete batch and its registers' : 'Delete batch' }}
      </button>
    </form>
  </BottomSheet>
</template>
