<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { X } from 'lucide-vue-next'

defineProps<{ title: string; description?: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-float focus:outline-none"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" aria-hidden="true" />
        <div class="mb-4 flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <DialogTitle class="font-serif text-xl font-semibold">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="text-xs text-ink-muted">{{ description }}</DialogDescription>
          </div>
          <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full hover:bg-app" aria-label="Close" @click="open = false">
            <X class="size-4" />
          </button>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
