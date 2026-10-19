<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { KeyRound, LoaderCircle, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useAcademyStore } from '@/stores/academy'
import { changePasswordSchema } from '@/schemas/auth'

const auth = useAuthStore()
const academy = useAcademyStore()
const router = useRouter()
const forced = academy.mustChangePassword

const { handleSubmit, defineField, errors, isSubmitting, submitCount } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
  initialValues: { password: '', confirmPassword: '' },
})
const [password] = defineField('password')
const [confirmPassword] = defineField('confirmPassword')
const err = (k: 'password' | 'confirmPassword') => (submitCount.value > 0 ? errors.value[k] : undefined)

const saveError = ref<string | null>(null)

const onSubmit = handleSubmit(async ({ password }) => {
  saveError.value = null
  try {
    await auth.updatePassword(password)
    academy.markPasswordChanged()
    router.replace('/')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Could not change your password. Please try again.'
  }
})

async function signOut() {
  await auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card">
    <div class="h-[3px] shrink-0 outfield-stripes" aria-hidden="true" />
    <div class="flex flex-1 flex-col justify-center px-6 py-10">
      <div class="mb-8 flex flex-col items-center text-center">
        <KeyRound class="mb-4 size-10 text-turf" />
        <h1 class="font-serif text-2xl font-semibold">{{ forced ? 'Set your password' : 'Change password' }}</h1>
        <p class="mt-1 text-sm text-ink-muted">
          <template v-if="forced">You signed in with a temporary password. Choose your own to continue.</template>
          <template v-else>Choose a new password for {{ academy.profile?.username ?? 'your account' }}.</template>
        </p>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div>
          <label for="new-password" class="mb-1 block text-xs font-semibold text-ink-muted">New password</label>
          <input
            id="new-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="field-input"
            placeholder="••••••••"
            :aria-invalid="!!err('password')"
          />
          <p v-if="err('password')" class="mt-1.5 text-xs text-cherry">{{ err('password') }}</p>
        </div>
        <div>
          <label for="confirm-password" class="mb-1 block text-xs font-semibold text-ink-muted">Confirm password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="field-input"
            placeholder="••••••••"
            :aria-invalid="!!err('confirmPassword')"
          />
          <p v-if="err('confirmPassword')" class="mt-1.5 text-xs text-cherry">{{ err('confirmPassword') }}</p>
        </div>

        <p v-if="saveError" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ saveError }}</p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        >
          <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
          {{ isSubmitting ? 'Saving…' : 'Save password' }}
        </button>

        <button
          v-if="forced"
          type="button"
          class="inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-cherry"
          @click="signOut"
        >
          <LogOut class="size-4" /> Sign out
        </button>
        <button v-else type="button" class="w-full text-center text-sm font-semibold text-turf hover:underline" @click="router.back()">
          Cancel
        </button>
      </form>
    </div>
  </div>
</template>
