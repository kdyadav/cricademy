<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, UserPlus } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import TemporaryPassword from './TemporaryPassword.vue'
import { addMemberSchema, type AddMemberFormInput } from '@/schemas/auth'
import { membershipService, type AddMemberResult } from '@/services'

const props = defineProps<{ academyId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [] }>()

const busy = ref(false)
const failure = ref<string | null>(null)
const result = ref<AddMemberResult | null>(null)

const { handleSubmit, defineField, errors, submitCount, resetForm } = useForm({
  validationSchema: toTypedSchema(addMemberSchema),
})
const [username] = defineField('username')
const [displayName] = defineField('displayName')
const err = (path: keyof AddMemberFormInput) => (submitCount.value > 0 ? errors.value[path] : undefined)

watch(open, (isOpen) => {
  if (!isOpen) return
  failure.value = null
  result.value = null
  resetForm({ values: { username: '', displayName: '' } })
})

const onSubmit = handleSubmit(async (input) => {
  busy.value = true
  failure.value = null
  try {
    result.value = await membershipService.addMember({ academyId: props.academyId, role: 'coach', ...input })
    emit('added')
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : 'Could not add the coach.'
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <BottomSheet v-model:open="open" title="Add coach" description="New usernames get an account straight away. Existing users must accept first.">
    <template v-if="result">
      <TemporaryPassword v-if="result.temporaryPassword" :username="result.username" :password="result.temporaryPassword" />
      <p v-else-if="result.status === 'pending'" class="rounded-xl bg-mint/60 p-3 text-sm">
        <span class="font-semibold">{{ result.username }}</span> already has an account. They'll see your invitation when they sign in and must
        accept it before they can coach here.
      </p>
      <p v-else class="rounded-xl bg-mint/60 p-3 text-sm"><span class="font-semibold">{{ result.username }}</span> is already a coach here.</p>
      <button type="button" class="mt-4 w-full rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700" @click="open = false">
        Done
      </button>
    </template>
    <template v-else>
      <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div>
          <label for="m-username" class="mb-1 block text-xs font-semibold text-ink-muted">Username</label>
          <input
            id="m-username"
            v-model="username"
            class="field-input"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
            placeholder="e.g. rahul.k"
            :aria-invalid="!!err('username')"
          />
          <p v-if="err('username')" class="mt-1 text-xs text-cherry">{{ err('username') }}</p>
        </div>
        <div>
          <label for="m-name" class="mb-1 block text-xs font-semibold text-ink-muted">Name (optional)</label>
          <input id="m-name" v-model="displayName" class="field-input" placeholder="e.g. Rahul Kumar" />
          <p v-if="err('displayName')" class="mt-1 text-xs text-cherry">{{ err('displayName') }}</p>
        </div>
        <button
          type="submit"
          :disabled="busy"
          class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
        >
          <LoaderCircle v-if="busy" class="size-4 animate-spin" />
          <UserPlus v-else class="size-4" />
          Add coach
        </button>
      </form>
    </template>
  </BottomSheet>
</template>
