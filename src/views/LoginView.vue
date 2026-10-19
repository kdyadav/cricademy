<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import { useAuthStore } from '@/stores/auth'
import { signInSchema } from '@/schemas/auth'
import { DEMO_EMAIL } from '@/services/mock/auth'
import { isSupabaseEnabled } from '@/services'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const { handleSubmit, defineField, errors, isSubmitting, submitCount, setValues } = useForm({
  validationSchema: toTypedSchema(signInSchema),
  initialValues: { login: '', password: '' },
})
const [login] = defineField('login')
const [password] = defineField('password')
const err = (k: 'login' | 'password') => (submitCount.value > 0 ? errors.value[k] : undefined)

const authError = ref<string | null>(null)

const onSubmit = handleSubmit(async (input) => {
  authError.value = null
  try {
    await auth.signIn(input)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/ops'
    router.replace(redirect)
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Could not sign in. Please try again.'
  }
})

function useDemo() {
  setValues({ login: DEMO_EMAIL, password: 'demo1234' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card">
    <div class="h-[3px] shrink-0 outfield-stripes" aria-hidden="true" />
    <div class="flex flex-1 flex-col justify-center px-6 py-10">
      <div class="mb-8 flex flex-col items-center text-center">
        <AcademyCrest class="mb-4 scale-125" />
        <h1 class="font-serif text-2xl font-semibold">Cricademy</h1>
        <p class="mt-1 text-sm text-ink-muted">Sign in with your username or email</p>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div>
          <label for="login-id" class="mb-1 block text-xs font-semibold text-ink-muted">Username or email</label>
          <input
            id="login-id"
            v-model="login"
            type="text"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            autocomplete="username"
            class="field-input"
            placeholder="username"
            :aria-invalid="!!err('login')"
          />
          <p v-if="err('login')" class="mt-1.5 text-xs text-cherry">{{ err('login') }}</p>
        </div>
        <div>
          <label for="login-password" class="mb-1 block text-xs font-semibold text-ink-muted">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="field-input"
            placeholder="••••••••"
            :aria-invalid="!!err('password')"
          />
          <p v-if="err('password')" class="mt-1.5 text-xs text-cherry">{{ err('password') }}</p>
        </div>

        <p v-if="authError" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ authError }}</p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        >
          <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>

        <p class="text-center text-sm text-ink-muted">
          New coach?
          <RouterLink :to="{ name: 'signup' }" class="font-semibold text-turf hover:underline">Create an account</RouterLink>
        </p>
      </form>

      <div v-if="!isSupabaseEnabled" class="mt-6 rounded-xl border border-dashed border-hairline bg-app p-3 text-xs text-ink-muted">
        <p class="font-semibold text-ink">Demo mode</p>
        <p class="mt-0.5">Any username or email with a 6+ character password works. A new one starts at onboarding.</p>
        <button type="button" class="mt-2 font-semibold text-turf hover:underline" @click="useDemo">Fill demo coach (Vikram)</button>
      </div>
    </div>
  </div>
</template>
