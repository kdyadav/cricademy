<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFieldArray, useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { Award, Camera, Check, ChevronLeft, Clock, LoaderCircle, LogOut, MapPin, Plus, Target, Trash2, UserRound } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useCoachStore } from '@/stores/coach'
import { coachProfileSchema, type BatchScheduleInput } from '@/schemas/coach'
import { ACCREDITATION_OPTIONS, DISCIPLINE_OPTIONS } from '@/data/options'
import type { Accreditation, Discipline } from '@/types'
import { cn } from '@/lib/cn'
import { newId } from '@/lib/id'

const router = useRouter()
const auth = useAuthStore()
const coach = useCoachStore()
const existing = coach.profile
const isNew = existing === null

const emptySchedule = (): BatchScheduleInput => ({ id: newId(), label: '', start: '', end: '' })

const { handleSubmit, defineField, errors, values, isSubmitting, submitCount, validate } = useForm({
  validationSchema: toTypedSchema(coachProfileSchema),
  initialValues: {
    name: existing?.name ?? '',
    accreditation: existing?.accreditation ?? undefined,
    disciplines: existing ? [...existing.disciplines] : [],
    facility: existing?.facility ?? '',
    pitch: existing?.pitch ?? '',
    schedules: existing ? existing.schedules.map(({ id, label, start, end }) => ({ id, label, start, end })) : [emptySchedule()],
  },
})

const fieldOpts = { validateOnModelUpdate: false, validateOnBlur: false }
const [name] = defineField('name', fieldOpts)
const [accreditation] = defineField('accreditation', fieldOpts)
const [disciplines] = defineField('disciplines', fieldOpts)
const [facility] = defineField('facility', fieldOpts)
const [pitch] = defineField('pitch', fieldOpts)
const { fields: schedules, push, remove } = useFieldArray<BatchScheduleInput>('schedules')

// Errors appear after the first save attempt, then update live.
watch(values, () => submitCount.value > 0 && validate(), { deep: true })
const err = (path: string) =>
  submitCount.value > 0 ? (errors.value as Record<string, string | undefined>)[path] : undefined

const saveError = ref<string | null>(null)

// Photo: undefined = unchanged, null = removed, File = new upload on save.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const photoInput = ref<HTMLInputElement | null>(null)
const avatarFile = ref<File | null | undefined>(undefined)
const objectUrl = ref<string | null>(null)
const photoError = ref<string | null>(null)
const avatarPreview = computed(() => {
  if (avatarFile.value === null) return undefined
  return objectUrl.value ?? existing?.avatarUrl
})

function setObjectUrl(url: string | null) {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = url
}

function onPhotoPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  photoError.value = null
  if (!file.type.startsWith('image/')) return void (photoError.value = 'Choose an image file')
  if (file.size > MAX_PHOTO_BYTES) return void (photoError.value = 'Photo must be under 5 MB')
  avatarFile.value = file
  setObjectUrl(URL.createObjectURL(file))
}

function removePhoto() {
  avatarFile.value = null
  photoError.value = null
  setObjectUrl(null)
}

onBeforeUnmount(() => setObjectUrl(null))

function leave() {
  if (window.history.state?.back) router.back()
  else router.replace('/ops')
}

async function signOut() {
  await auth.signOut()
  router.replace({ name: 'login' })
}

const onSubmit = handleSubmit(async (input) => {
  saveError.value = null
  try {
    await coach.saveProfile(input, avatarFile.value)
    if (isNew) router.replace('/ops')
    else leave()
  } catch {
    saveError.value = 'Could not save your profile. Please try again.'
  }
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-app">
    <header class="shrink-0 bg-card">
      <div class="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5">
        <button
          v-if="!isNew"
          type="button"
          class="grid size-10 place-items-center rounded-full border border-hairline hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          aria-label="Back"
          @click="leave"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="font-serif text-xl leading-tight font-semibold">{{ isNew ? 'Set up your coach profile' : 'Coach profile' }}</h1>
          <p class="text-xs text-ink-muted">Discipline selection & pavilion registry</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-cherry-soft hover:text-cherry focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none"
          @click="signOut"
        >
          <LogOut class="size-3.5" /> Sign out
        </button>
      </div>
      <div class="h-[3px] outfield-stripes" aria-hidden="true" />
    </header>

    <form id="coach-profile" class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" novalidate @submit.prevent="onSubmit">
      <!-- Identity -->
      <section class="card p-4">
        <h2 class="mb-3 flex items-center gap-2 text-base font-semibold"><UserRound class="size-4 text-turf" /> Identity</h2>
        <div class="flex items-center gap-3">
          <div class="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              class="relative rounded-full focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none"
              :aria-label="avatarPreview ? 'Change photo' : 'Add photo'"
              @click="photoInput?.click()"
            >
              <UiAvatar :name="name?.trim() || 'Coach'" :src="avatarPreview" size="lg" class="ring-hairline" />
              <span class="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-turf-900 text-white ring-2 ring-white">
                <Camera class="size-3" />
              </span>
            </button>
            <button v-if="avatarPreview" type="button" class="text-[11px] font-semibold text-ink-muted hover:text-cherry" @click="removePhoto">
              Remove
            </button>
            <input ref="photoInput" type="file" accept="image/*" class="sr-only" tabindex="-1" aria-hidden="true" @change="onPhotoPicked" />
          </div>
          <div class="min-w-0 flex-1">
            <label for="coach-name" class="mb-1 block text-xs font-semibold text-ink-muted">Full name</label>
            <input id="coach-name" v-model="name" class="field-input" autocomplete="name" placeholder="e.g. Vikram Rathore" :aria-invalid="!!err('name')" />
          </div>
        </div>
        <p v-if="photoError" class="mt-1.5 text-xs text-cherry">{{ photoError }}</p>
        <p v-if="err('name')" class="mt-1.5 text-xs text-cherry">{{ err('name') }}</p>
      </section>

      <!-- Accreditation -->
      <section class="card p-4">
        <h2 class="mb-3 flex items-center gap-2 text-base font-semibold"><Award class="size-4 text-turf" /> Accreditation</h2>
        <RadioGroupRoot
          :model-value="accreditation"
          class="space-y-2"
          aria-label="Coaching accreditation"
          @update:model-value="(v) => (accreditation = v as Accreditation)"
        >
          <RadioGroupItem
            v-for="opt in ACCREDITATION_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            class="flex w-full items-center gap-3 rounded-lg border border-hairline px-3.5 py-3 text-left transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none data-[state=checked]:border-turf data-[state=checked]:bg-mint"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">{{ opt.label }}</span>
              <span class="block text-xs text-ink-muted">{{ opt.body }}</span>
            </span>
            <span class="grid size-5 place-items-center rounded-full border border-hairline bg-card">
              <RadioGroupIndicator class="grid size-5 place-items-center rounded-full bg-turf text-white">
                <Check class="size-3" />
              </RadioGroupIndicator>
            </span>
          </RadioGroupItem>
        </RadioGroupRoot>
        <p v-if="err('accreditation')" class="mt-1.5 text-xs text-cherry">{{ err('accreditation') }}</p>
      </section>

      <!-- Disciplines -->
      <section class="card p-4">
        <h2 class="mb-1 flex items-center gap-2 text-base font-semibold"><Target class="size-4 text-turf" /> Disciplines</h2>
        <p class="mb-3 text-xs text-ink-muted">Select every discipline you coach.</p>
        <ToggleGroupRoot
          type="multiple"
          :model-value="disciplines"
          class="grid grid-cols-2 gap-2"
          aria-label="Coaching disciplines"
          @update:model-value="(v) => (disciplines = v as Discipline[])"
        >
          <ToggleGroupItem
            v-for="opt in DISCIPLINE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            class="rounded-lg border border-hairline px-3 py-2.5 text-left transition hover:bg-app focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none data-[state=on]:border-turf-900 data-[state=on]:bg-turf-900 data-[state=on]:text-white"
          >
            <span class="block text-sm font-semibold">{{ opt.label }}</span>
            <span class="block text-[11px] opacity-70">{{ opt.hint }}</span>
          </ToggleGroupItem>
        </ToggleGroupRoot>
        <p v-if="err('disciplines')" class="mt-1.5 text-xs text-cherry">{{ err('disciplines') }}</p>
      </section>

      <!-- Facility -->
      <section class="card space-y-3 p-4">
        <h2 class="flex items-center gap-2 text-base font-semibold"><MapPin class="size-4 text-turf" /> Home ground</h2>
        <div>
          <label for="coach-facility" class="mb-1 block text-xs font-semibold text-ink-muted">Facility</label>
          <input id="coach-facility" v-model="facility" class="field-input" placeholder="e.g. Apex High Performance Academy" :aria-invalid="!!err('facility')" />
          <p v-if="err('facility')" class="mt-1.5 text-xs text-cherry">{{ err('facility') }}</p>
        </div>
        <div>
          <label for="coach-pitch" class="mb-1 block text-xs font-semibold text-ink-muted">Primary pitch / net</label>
          <input id="coach-pitch" v-model="pitch" class="field-input" placeholder="e.g. Oval Turf Pitch 3" :aria-invalid="!!err('pitch')" />
          <p v-if="err('pitch')" class="mt-1.5 text-xs text-cherry">{{ err('pitch') }}</p>
        </div>
      </section>

      <!-- Batch schedules -->
      <section class="card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-base font-semibold"><Clock class="size-4 text-turf" /> Batch schedule</h2>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-turf hover:bg-mint disabled:opacity-40"
            :disabled="schedules.length >= 6"
            @click="push(emptySchedule())"
          >
            <Plus class="size-3.5" /> Add batch
          </button>
        </div>

        <ul class="space-y-3">
          <li v-for="(field, i) in schedules" :key="field.key" class="rounded-lg border border-hairline p-3">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <label :for="`batch-label-${i}`" class="sr-only">Batch name</label>
                <input
                  :id="`batch-label-${i}`"
                  v-model="field.value.label"
                  class="field-input py-2.5"
                  placeholder="e.g. Morning Nets"
                  :aria-invalid="!!err(`schedules[${i}].label`)"
                />
              </div>
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-cherry-soft hover:text-cherry disabled:opacity-30"
                :disabled="schedules.length === 1"
                :aria-label="`Remove ${field.value.label || 'batch'}`"
                @click="remove(i)"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
            <p v-if="err(`schedules[${i}].label`)" class="mt-1 text-xs text-cherry">{{ err(`schedules[${i}].label`) }}</p>

            <div class="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label :for="`batch-start-${i}`" class="mb-1 block text-[11px] font-semibold text-ink-muted">Starts</label>
                <input :id="`batch-start-${i}`" v-model="field.value.start" type="time" class="field-input py-2.5 tabular-nums" :aria-invalid="!!err(`schedules[${i}].start`)" />
              </div>
              <div>
                <label :for="`batch-end-${i}`" class="mb-1 block text-[11px] font-semibold text-ink-muted">Ends</label>
                <input :id="`batch-end-${i}`" v-model="field.value.end" type="time" class="field-input py-2.5 tabular-nums" :aria-invalid="!!err(`schedules[${i}].end`)" />
              </div>
            </div>
            <p v-if="err(`schedules[${i}].start`) || err(`schedules[${i}].end`)" class="mt-1 text-xs text-cherry">
              {{ err(`schedules[${i}].start`) ?? err(`schedules[${i}].end`) }}
            </p>
          </li>
        </ul>
        <p v-if="err('schedules')" class="mt-1.5 text-xs text-cherry">{{ err('schedules') }}</p>
      </section>
    </form>

    <footer class="shrink-0 border-t border-hairline bg-card px-4 pt-3 pb-safe">
      <p v-if="saveError" role="alert" class="mb-2 text-xs text-cherry">{{ saveError }}</p>
      <button
        type="submit"
        form="coach-profile"
        :disabled="isSubmitting"
        :class="
          cn(
            'flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white transition hover:bg-turf-700 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 focus-visible:outline-none',
            isSubmitting && 'opacity-70',
          )
        "
      >
        <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
        {{ isSubmitting ? 'Saving…' : isNew ? 'Enter the pavilion' : 'Save profile' }}
      </button>
    </footer>
  </div>
</template>
