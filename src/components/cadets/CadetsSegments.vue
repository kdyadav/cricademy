<script setup lang="ts">
import { useRoute } from 'vue-router'
import { cn } from '@/lib/cn'

const route = useRoute()

const segments = [
  { name: 'ops', label: 'Register' },
  { name: 'cadets', label: 'Squad' },
  { name: 'nets', label: 'Nets' },
] as const
</script>

<template>
  <nav class="grid grid-cols-3 gap-1 rounded-full bg-card p-1 shadow-card" aria-label="Cadets">
    <RouterLink
      v-for="s in segments"
      :key="s.name"
      :to="{ name: s.name }"
      replace
      :aria-current="route.name === s.name ? 'page' : undefined"
      :class="
        cn(
          'rounded-full py-1.5 text-center text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none',
          route.name === s.name ? 'bg-turf-900 text-white' : 'text-ink-muted hover:text-ink',
        )
      "
    >
      {{ s.label }}
    </RouterLink>
  </nav>
</template>
