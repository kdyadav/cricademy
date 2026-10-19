<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, LoaderCircle } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import type { AcademyMember } from '@/services'
import type { NetBatch } from '@/types'
import { cn } from '@/lib/cn'

const props = defineProps<{
  coach: AcademyMember | null
  batches: NetBatch[]
  assigned: Set<string>
  toggle: (batchId: string, assign: boolean) => Promise<void>
}>()
const open = defineModel<boolean>('open', { required: true })

const busyId = ref<string | null>(null)
const failure = ref<string | null>(null)

watch(open, (isOpen) => isOpen && (failure.value = null))

async function flip(batchId: string) {
  busyId.value = batchId
  failure.value = null
  try {
    await props.toggle(batchId, !props.assigned.has(batchId))
  } catch (e) {
    failure.value = e instanceof Error && e.message ? e.message : 'Could not update the batch.'
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <BottomSheet
    v-model:open="open"
    :title="`Batches for ${coach?.displayName || coach?.username || 'coach'}`"
    description="Coaches only see the batches, cadets and records of batches they're assigned to."
  >
    <p v-if="failure" role="alert" class="mb-3 rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ failure }}</p>
    <p v-if="!batches.length" class="py-6 text-center text-sm text-ink-muted">No batches yet. Add one from Daily Ops.</p>
    <ul v-else class="space-y-2">
      <li v-for="b in batches" :key="b.id">
        <button
          type="button"
          role="checkbox"
          :aria-checked="assigned.has(b.id)"
          :disabled="busyId !== null"
          :class="cn('card flex w-full items-center gap-3 p-3 text-left hover:bg-mint/60 disabled:opacity-70', assigned.has(b.id) && 'ring-2 ring-turf')"
          @click="flip(b.id)"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ b.label }}</p>
            <p class="text-xs text-ink-muted">{{ b.ageGroup }} · {{ b.start }}–{{ b.end }}</p>
          </div>
          <LoaderCircle v-if="busyId === b.id" class="size-4 animate-spin text-ink-muted" />
          <Check v-else-if="assigned.has(b.id)" class="size-4 text-turf" />
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
