<script setup lang="ts" generic="T extends string">
import { cn } from '@/lib/cn'

defineProps<{ legend: string; options: readonly T[]; error?: string }>()
const model = defineModel<T | undefined>()
</script>

<template>
  <fieldset>
    <legend class="mb-1.5 text-xs font-semibold text-ink-muted">{{ legend }}</legend>
    <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }">
      <button
        v-for="o in options"
        :key="o"
        type="button"
        :aria-pressed="model === o"
        :class="
          cn(
            'truncate rounded-lg border px-1 py-2 text-xs font-semibold transition',
            model === o ? 'border-turf-900 bg-turf-900 text-white' : 'border-hairline bg-card hover:bg-app',
          )
        "
        @click="model = o"
      >
        {{ o }}
      </button>
    </div>
    <p v-if="error" class="mt-1 text-xs text-cherry">{{ error }}</p>
  </fieldset>
</template>
