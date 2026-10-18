<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    name: string
    src?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    class?: string
  }>(),
  { size: 'md' },
)

const initials = computed(() =>
  props.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

// Deterministic turf-toned background per name
const hue = computed(() => [...props.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4)
const tones = ['bg-mint text-turf-600', 'bg-mint-strong text-turf', 'bg-gold-soft text-clay', 'bg-cherry-soft text-cherry']

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-white',
        sizes[size],
        !src && tones[hue],
        props.class,
      )
    "
  >
    <img v-if="src" :src="src" :alt="name" class="size-full object-cover" />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>
