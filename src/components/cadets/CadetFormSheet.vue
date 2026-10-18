<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, Save, Trash2 } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ChoiceGroup from '@/components/ui/ChoiceGroup.vue'
import { useAuthStore } from '@/stores/auth'
import { useCadetsStore } from '@/stores/cadets'
import { useOpsStore } from '@/stores/ops'
import { cadetSchema, type CadetFormInput } from '@/schemas/academy'
import { AGE_GROUP_OPTIONS, ROLE_OPTIONS } from '@/data/options'
import { cn } from '@/lib/cn'

const props = defineProps<{ cadetId: string | null }>()
const open = defineModel<boolean>('open', { required: true })

const auth = useAuthStore()
const store = useCadetsStore()
const ops = useOpsStore()
const cadet = computed(() => (props.cadetId ? store.byId(props.cadetId) : null))
const busy = ref(false)
const failure = ref<string | null>(null)
const confirmDelete = ref(false)

const { handleSubmit, defineField, errors, submitCount, resetForm } = useForm({ validationSchema: toTypedSchema(cadetSchema) })
const [name] = defineField('name')
const [jersey] = defineField('jersey')
const [ageGroup] = defineField('ageGroup')
const [role] = defineField('role')
const [battingHand] = defineField('battingHand')
const [bowlingStyle] = defineField('bowlingStyle')
const [batchId] = defineField('batchId')
const [feeDue] = defineField('feeDue')
const err = (path: keyof CadetFormInput) => (submitCount.value > 0 ? errors.value[path] : undefined)

const nextJersey = () => Math.max(0, ...store.cadets.map((c) => c.jersey)) + 1

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  confirmDelete.value = false
  const c = cadet.value
  resetForm({
    values: c
      ? { ...c, bowlingStyle: c.bowlingStyle ?? '' }
      : { name: '', jersey: nextJersey(), ageGroup: ops.activeBatch?.ageGroup, role: undefined, battingHand: 'Right', bowlingStyle: '', batchId: ops.activeBatchId ?? '', feeDue: 0 },
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
  attempt(() => store.save(auth.user!.id, { ...input, bowlingStyle: input.bowlingStyle || undefined }, cadet.value?.id), 'Could not save the cadet.'),
)

function remove() {
  if (!cadet.value) return
  if (!confirmDelete.value) return void (confirmDelete.value = true)
  const id = cadet.value.id
  return attempt(() => store.remove(id), 'Could not remove the cadet.')
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="cadet ? 'Edit cadet' : 'Add cadet'" :description="cadet ? `#${cadet.jersey} · ${cadet.name}` : 'Add a player to your squad.'">
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div class="grid grid-cols-[1fr_5.5rem] gap-3">
        <div>
          <label for="c-name" class="mb-1 block text-xs font-semibold text-ink-muted">Full name</label>
          <input id="c-name" v-model="name" class="field-input" autocomplete="off" placeholder="e.g. Aarav Sharma" :aria-invalid="!!err('name')" />
          <p v-if="err('name')" class="mt-1 text-xs text-cherry">{{ err('name') }}</p>
        </div>
        <div>
          <label for="c-jersey" class="mb-1 block text-xs font-semibold text-ink-muted">Jersey #</label>
          <input id="c-jersey" v-model="jersey" type="number" inputmode="numeric" min="0" max="999" class="field-input" :aria-invalid="!!err('jersey')" />
          <p v-if="err('jersey')" class="mt-1 text-xs text-cherry">{{ err('jersey') }}</p>
        </div>
      </div>
      <ChoiceGroup v-model="ageGroup" legend="Age group" :options="AGE_GROUP_OPTIONS" :error="err('ageGroup')" />
      <ChoiceGroup v-model="role" legend="Playing role" :options="ROLE_OPTIONS" :error="err('role')" />
      <ChoiceGroup v-model="battingHand" legend="Bats" :options="['Right', 'Left'] as const" :error="err('battingHand')" />
      <div>
        <label for="c-bowling" class="mb-1 block text-xs font-semibold text-ink-muted">Bowling style <span class="font-normal">(optional)</span></label>
        <input id="c-bowling" v-model="bowlingStyle" class="field-input" placeholder="e.g. Right-arm fast" />
        <p v-if="err('bowlingStyle')" class="mt-1 text-xs text-cherry">{{ err('bowlingStyle') }}</p>
      </div>
      <div class="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <label for="c-batch" class="mb-1 block text-xs font-semibold text-ink-muted">Net batch</label>
          <select id="c-batch" v-model="batchId" class="field-input">
            <option value="">Not in a batch</option>
            <option v-for="b in ops.batches" :key="b.id" :value="b.id">{{ b.label }}</option>
          </select>
        </div>
        <div>
          <label for="c-fee" class="mb-1 block text-xs font-semibold text-ink-muted">Fees due ($)</label>
          <input id="c-fee" v-model="feeDue" type="number" inputmode="decimal" min="0" step="1" class="field-input" :aria-invalid="!!err('feeDue')" />
          <p v-if="err('feeDue')" class="mt-1 text-xs text-cherry">{{ err('feeDue') }}</p>
        </div>
      </div>

      <button
        type="submit"
        :disabled="busy"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ cadet ? 'Save changes' : 'Add to squad' }}
      </button>
      <button
        v-if="cadet"
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
        {{ confirmDelete ? 'Tap again — their net sessions are deleted too' : 'Remove from squad' }}
      </button>
    </form>
  </BottomSheet>
</template>
