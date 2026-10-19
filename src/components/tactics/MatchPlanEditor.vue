<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ChevronLeft, LoaderCircle, Save, Trash2 } from 'lucide-vue-next'
import ChoiceGroup from '@/components/ui/ChoiceGroup.vue'
import XiBuilder from './XiBuilder.vue'
import { useAcademyStore } from '@/stores/academy'
import { useCadetsStore } from '@/stores/cadets'
import { useTacticsStore } from '@/stores/tactics'
import { localDate } from '@/stores/ops'
import { matchPlanSchema, type MatchPlanFormInput } from '@/schemas/academy'
import { AGE_GROUP_OPTIONS, MATCH_FORMAT_OPTIONS } from '@/data/options'
import type { MatchPlan } from '@/types'
import { cn } from '@/lib/cn'

const props = defineProps<{ plan: MatchPlan | null }>()
const emit = defineEmits<{ close: [] }>()

const academy = useAcademyStore()
const squad = useCadetsStore()
const store = useTacticsStore()

const { handleSubmit, defineField, errors, submitCount, values } = useForm({
  validationSchema: toTypedSchema(matchPlanSchema),
  initialValues: props.plan
    ? { opponent: props.plan.opponent, date: props.plan.date, venue: props.plan.venue, format: props.plan.format, ageGroup: props.plan.ageGroup }
    : { opponent: '', date: localDate(), venue: '', format: 'T20', ageGroup: undefined },
})
const [opponent] = defineField('opponent')
const [date] = defineField('date')
const [venue] = defineField('venue')
const [format] = defineField('format')
const [ageGroup] = defineField('ageGroup')
const err = (path: keyof MatchPlanFormInput) => (submitCount.value > 0 ? errors.value[path] : undefined)

const xi = ref<string[]>([...(props.plan?.xi ?? [])])
const captainId = ref<string | null>(props.plan?.captainId ?? null)
const keeperId = ref<string | null>(props.plan?.keeperId ?? null)
const notes = ref(props.plan?.notes ?? '')
const allAges = ref(false)

const pool = computed(() => squad.cadets.filter((c) => allAges.value || !values.ageGroup || c.ageGroup === values.ageGroup))

const busy = ref(false)
const failure = ref<string | null>(null)
const confirmDelete = ref(false)

async function attempt(action: () => Promise<unknown>, fallback: string) {
  busy.value = true
  failure.value = null
  try {
    await action()
    emit('close')
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : fallback
  } finally {
    busy.value = false
  }
}

const onSubmit = handleSubmit((input) =>
  attempt(
    () =>
      store.save(
        academy.activeId!,
        { ...input, xi: xi.value, captainId: captainId.value, keeperId: keeperId.value, notes: notes.value.trim() },
        props.plan?.id,
      ),
    'Could not save the match plan.',
  ),
)

function remove() {
  if (!props.plan) return
  if (!confirmDelete.value) return void (confirmDelete.value = true)
  const id = props.plan.id
  return attempt(() => store.remove(id), 'Could not delete the match plan.')
}
</script>

<template>
  <form class="space-y-5 px-4 pt-4 pb-6" novalidate @submit.prevent="onSubmit">
    <button type="button" class="-ml-1 inline-flex items-center gap-0.5 text-sm font-semibold text-turf" @click="emit('close')">
      <ChevronLeft class="size-4" /> Match plans
    </button>
    <h1 class="font-serif text-2xl font-semibold">{{ plan ? `vs ${plan.opponent}` : 'New match plan' }}</h1>
    <p v-if="failure" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>

    <section class="card space-y-4 p-4" aria-label="Fixture">
      <div>
        <label for="m-opp" class="mb-1 block text-xs font-semibold text-ink-muted">Opponent</label>
        <input id="m-opp" v-model="opponent" class="field-input" placeholder="e.g. Mumbai Colts CC" :aria-invalid="!!err('opponent')" />
        <p v-if="err('opponent')" class="mt-1 text-xs text-cherry">{{ err('opponent') }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="m-date" class="mb-1 block text-xs font-semibold text-ink-muted">Date</label>
          <input id="m-date" v-model="date" type="date" class="field-input" :aria-invalid="!!err('date')" />
          <p v-if="err('date')" class="mt-1 text-xs text-cherry">{{ err('date') }}</p>
        </div>
        <div>
          <label for="m-venue" class="mb-1 block text-xs font-semibold text-ink-muted">Venue</label>
          <input id="m-venue" v-model="venue" class="field-input" placeholder="Home ground" />
          <p v-if="err('venue')" class="mt-1 text-xs text-cherry">{{ err('venue') }}</p>
        </div>
      </div>
      <ChoiceGroup v-model="format" legend="Format" :options="MATCH_FORMAT_OPTIONS" :error="err('format')" />
      <ChoiceGroup v-model="ageGroup" legend="Age group" :options="AGE_GROUP_OPTIONS" :error="err('ageGroup')" />
      <label class="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <input v-model="allAges" type="checkbox" class="size-4 accent-turf-900" /> Pick from every age group (play-ups)
      </label>
    </section>

    <XiBuilder v-model:xi="xi" v-model:captain-id="captainId" v-model:keeper-id="keeperId" :pool="pool" :squad="squad.cadets" />

    <div>
      <label for="m-notes" class="mb-1 block text-xs font-semibold text-ink-muted">Game plan &amp; notes</label>
      <textarea id="m-notes" v-model="notes" rows="4" maxlength="2000" class="field-input" placeholder="Toss call, bowling changes, field settings…" />
    </div>

    <div class="space-y-2">
      <button
        type="submit"
        :disabled="busy"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-turf-900 py-3.5 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-60"
      >
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <Save v-else class="size-4" /> Save match plan
      </button>
      <button
        v-if="plan"
        type="button"
        :disabled="busy"
        :class="cn('flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold transition disabled:opacity-60', confirmDelete ? 'bg-cherry text-white' : 'text-cherry hover:bg-cherry-soft')"
        @click="remove"
      >
        <Trash2 class="size-4" /> {{ confirmDelete ? 'Tap again to delete' : 'Delete match plan' }}
      </button>
    </div>
  </form>
</template>
