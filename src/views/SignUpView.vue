<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, MailCheck } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { useAuthStore } from '@/stores/auth'
import { signUpSchema } from '@/schemas/auth'

const auth = useAuthStore()
const router = useRouter()

const { handleSubmit, defineField, errors, isSubmitting, submitCount } = useForm({
  validationSchema: toTypedSchema(signUpSchema),
  initialValues: { email: '', password: '', confirmPassword: '' },
})
const [email] = defineField('email')
const [password] = defineField('password')
const [confirmPassword] = defineField('confirmPassword')
const err = (k: 'email' | 'password' | 'confirmPassword') => (submitCount.value > 0 ? errors.value[k] : undefined)

const authError = ref<string | null>(null)
/** Set once the account is created but still needs email confirmation. */
const pendingEmail = ref<string | null>(null)

const onSubmit = handleSubmit(async ({ email, password }) => {
  authError.value = null
  try {
    const active = await auth.signUp({ email, password })
    if (active) router.replace({ name: 'onboarding' })
    else pendingEmail.value = email.trim().toLowerCase()
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Could not create your account. Please try again.'
  }
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card">
    <div class="h-[3px] shrink-0 outfield-stripes" aria-hidden="true" />
    <div class="flex flex-1 flex-col justify-center px-6 py-10">
      <div class="mb-8 flex flex-col items-center text-center">
        <AcademyCrest class="mb-4 scale-125" />
        <h1 class="font-serif text-2xl font-semibold">Cricademy</h1>
        <p class="mt-1 text-sm text-ink-muted">Create an account and set up your academy</p>
      </div>

      <div v-if="pendingEmail" role="status" class="rounded-xl border border-hairline bg-app p-5 text-center">
        <MailCheck class="mx-auto mb-3 size-8 text-turf" />
        <h2 class="text-base font-semibold">Check your inbox</h2>
        <p class="mt-1 text-sm text-ink-muted">
          We sent a confirmation link to <span class="font-semibold text-ink">{{ pendingEmail }}</span>. Open it on this device to finish signing
          up.
        </p>
        <RouterLink :to="{ name: 'login' }" class="mt-4 inline-block text-sm font-semibold text-turf hover:underline">Back to sign in</RouterLink>
      </div>

      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div>
          <label for="signup-email" class="mb-1 block text-xs font-semibold text-ink-muted">Email</label>
          <input
            id="signup-email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            class="field-input"
            placeholder="coach@academy.com"
            :aria-invalid="!!err('email')"
          />
          <p v-if="err('email')" class="mt-1.5 text-xs text-cherry">{{ err('email') }}</p>
        </div>
        <div>
          <label for="signup-password" class="mb-1 block text-xs font-semibold text-ink-muted">Password</label>
          <input
            id="signup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="field-input"
            placeholder="At least 6 characters"
            :aria-invalid="!!err('password')"
          />
          <p v-if="err('password')" class="mt-1.5 text-xs text-cherry">{{ err('password') }}</p>
        </div>
        <div>
          <label for="signup-confirm" class="mb-1 block text-xs font-semibold text-ink-muted">Confirm password</label>
          <input
            id="signup-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="field-input"
            placeholder="••••••••"
            :aria-invalid="!!err('confirmPassword')"
          />
          <p v-if="err('confirmPassword')" class="mt-1.5 text-xs text-cherry">{{ err('confirmPassword') }}</p>
        </div>

        <p v-if="authError" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ authError }}</p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        >
          <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
          {{ isSubmitting ? 'Creating account…' : 'Create account' }}
        </button>

        <p class="text-center text-sm text-ink-muted">
          Already have an account?
          <RouterLink :to="{ name: 'login' }" class="font-semibold text-turf hover:underline">Sign in</RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>
