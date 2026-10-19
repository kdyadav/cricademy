<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ChevronRight, LoaderCircle } from 'lucide-vue-next'
import AcademyCrest from '@/components/layout/AcademyCrest.vue'
import GuardianCadetCard from '@/components/cadets/GuardianCadetCard.vue'
import { useAcademyStore } from '@/stores/academy'
import { useCadetsStore } from '@/stores/cadets'
import { useFeesStore } from '@/stores/fees'
import { attendanceRepository } from '@/services'
import type { NetBatch } from '@/types'

const academy = useAcademyStore()
const store = useCadetsStore()
const fees = useFeesStore()
const { cadets, loading, error } = storeToRefs(store)
const batches = ref<NetBatch[]>([])

// Guardians can only read their own linked cadets, their batches and fees, so the academy's lists are just theirs.
watch(
  () => academy.activeId,
  async (id) => {
    if (!id) return
    store.load(id)
    fees.load(id, true)
    batches.value = await attendanceRepository.listBatches(id).catch(() => [])
  },
  { immediate: true },
)

const batchOf = (batchId: string) => batches.value.find((b) => b.id === batchId) ?? null
const duesOf = (cadetId: string) => fees.dues.filter((d) => d.cadetId === cadetId)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-app">
    <header class="shrink-0 bg-card">
      <RouterLink
        :to="{ name: 'academies' }"
        class="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5 hover:bg-app"
      >
        <AcademyCrest />
        <div class="min-w-0 flex-1">
          <p class="truncate font-serif text-[17px] leading-tight font-semibold tracking-tight">{{ academy.active?.academyName }}</p>
          <p class="mt-0.5 text-[11px] font-medium text-ink-muted">Guardian</p>
        </div>
        <span v-if="academy.pending.length" class="size-2 rounded-full bg-cherry" aria-label="New invitation" />
        <ChevronRight class="size-4 text-ink-muted" />
      </RouterLink>
      <div class="h-[3px] outfield-stripes" aria-hidden="true" />
    </header>

    <div class="space-y-3 px-4 py-5">
      <h1 class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Your cadets</h1>
      <div v-if="loading" class="flex justify-center py-8"><LoaderCircle class="size-6 animate-spin text-ink-muted" /></div>
      <p v-else-if="error" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ error }}</p>
      <p v-else-if="!cadets.length" class="card p-4 text-center text-sm text-ink-muted">No cadets are linked to you in this academy yet.</p>
      <template v-else>
        <p v-if="fees.error" role="alert" class="rounded-lg bg-cherry-soft px-3 py-2 text-xs text-cherry">{{ fees.error }}</p>
        <GuardianCadetCard
          v-for="c in cadets"
          :key="c.id"
          :cadet="c"
          :batch="batchOf(c.batchId)"
          :dues="duesOf(c.id)"
          :class="cadets.length > 1 && 'border-b border-hairline pb-5'"
        />
      </template>
    </div>
  </div>
</template>
