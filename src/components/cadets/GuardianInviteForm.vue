<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Check, LoaderCircle, Mail, MessageCircle } from 'lucide-vue-next'
import type { Guardian, GuardianPermission } from '@/types'
import { guardianInviteSchema, isEmailContact, type GuardianInviteFormInput } from '@/schemas/guardian'
import { PERMISSION_OPTIONS, RELATIONSHIP_OPTIONS } from '@/data/options'
import { cn } from '@/lib/cn'

const props = defineProps<{ initial?: Guardian; submitting: boolean }>()
const emit = defineEmits<{ submit: [input: GuardianInviteFormInput]; cancel: [] }>()

const { handleSubmit, defineField, errors, values, submitCount, validate } = useForm({
  validationSchema: toTypedSchema(guardianInviteSchema),
  initialValues: {
    name: props.initial?.name ?? '',
    contact: props.initial?.contact ?? '',
    relationship: props.initial?.relationship,
    permissions: props.initial ? [...props.initial.permissions] : ['fee_payer', 'attendance_signoff'],
  },
})

const fieldOpts = { validateOnModelUpdate: false, validateOnBlur: false }
const [name] = defineField('name', fieldOpts)
const [contact] = defineField('contact', fieldOpts)
const [relationship] = defineField('relationship', fieldOpts)
const [permissions] = defineField('permissions', fieldOpts)

watch(values, () => submitCount.value > 0 && validate(), { deep: true })
const err = (path: keyof GuardianInviteFormInput) => (submitCount.value > 0 ? errors.value[path] : undefined)

const viaEmail = computed(() => isEmailContact(contact.value ?? ''))

// "View only" is exclusive: picking it clears the others, and vice versa.
function togglePermission(p: GuardianPermission) {
  const current = permissions.value ?? []
  if (current.includes(p)) permissions.value = current.filter((x) => x !== p)
  else if (p === 'view_only') permissions.value = ['view_only']
  else permissions.value = [...current.filter((x) => x !== 'view_only'), p]
}

const onSubmit = handleSubmit((input) => emit('submit', input))
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="onSubmit">
    <div>
      <label for="g-name" class="mb-1 block text-xs font-semibold text-ink-muted">Guardian name</label>
      <input id="g-name" v-model="name" class="field-input" autocomplete="off" placeholder="e.g. Sunita Sharma" :aria-invalid="!!err('name')" />
      <p v-if="err('name')" class="mt-1 text-xs text-cherry">{{ err('name') }}</p>
    </div>

    <div>
      <label for="g-contact" class="mb-1 block text-xs font-semibold text-ink-muted">Mobile number or email</label>
      <input
        id="g-contact"
        v-model="contact"
        class="field-input"
        inputmode="email"
        autocomplete="off"
        placeholder="+91 98200 11234"
        :aria-invalid="!!err('contact')"
      />
      <p v-if="err('contact')" class="mt-1 text-xs text-cherry">{{ err('contact') }}</p>
    </div>

    <fieldset>
      <legend class="mb-1.5 text-xs font-semibold text-ink-muted">Relationship</legend>
      <div class="grid grid-cols-4 gap-1.5">
        <button
          v-for="r in RELATIONSHIP_OPTIONS"
          :key="r"
          type="button"
          :aria-pressed="relationship === r"
          :class="
            cn(
              'rounded-lg border py-2 text-xs font-semibold transition',
              relationship === r ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card hover:bg-app',
            )
          "
          @click="relationship = r"
        >
          {{ r }}
        </button>
      </div>
      <p v-if="err('relationship')" class="mt-1 text-xs text-cherry">{{ err('relationship') }}</p>
    </fieldset>

    <fieldset>
      <legend class="mb-1.5 text-xs font-semibold text-ink-muted">Permissions</legend>
      <div class="space-y-1.5">
        <button
          v-for="p in PERMISSION_OPTIONS"
          :key="p.value"
          type="button"
          :aria-pressed="permissions?.includes(p.value)"
          :class="
            cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
              permissions?.includes(p.value) ? 'border-turf bg-mint' : 'border-hairline bg-card hover:bg-app',
            )
          "
          @click="togglePermission(p.value)"
        >
          <span
            :class="
              cn(
                'grid size-5 shrink-0 place-items-center rounded border',
                permissions?.includes(p.value) ? 'border-turf bg-turf text-white' : 'border-hairline bg-card',
              )
            "
          >
            <Check v-if="permissions?.includes(p.value)" class="size-3.5" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold">{{ p.label }}</span>
            <span class="block text-[11px] text-ink-muted">{{ p.hint }}</span>
          </span>
        </button>
      </div>
      <p v-if="err('permissions')" class="mt-1 text-xs text-cherry">{{ err('permissions') }}</p>
    </fieldset>

    <div class="flex gap-2 pt-1">
      <button type="button" class="rounded-full border border-hairline px-5 py-3 text-sm font-semibold hover:bg-app" @click="emit('cancel')">
        Cancel
      </button>
      <button
        type="submit"
        :disabled="submitting"
        class="flex flex-1 items-center justify-center gap-2 rounded-full bg-turf-900 py-3 text-sm font-semibold text-white transition hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="submitting" class="size-4 animate-spin" />
        <Mail v-else-if="viaEmail" class="size-4" />
        <MessageCircle v-else class="size-4" />
        Send invite via {{ viaEmail ? 'email' : 'WhatsApp' }}
      </button>
    </div>
  </form>
</template>
