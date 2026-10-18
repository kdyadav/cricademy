<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import AppTopBar from './AppTopBar.vue'
import BottomNav from './BottomNav.vue'
import { useUiStore, type TabKey } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()

watch(
  () => route.fullPath,
  () => {
    const tab = route.meta.tab as TabKey | undefined
    if (tab) ui.rememberPath(tab, route.fullPath)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <AppTopBar />
    <main id="app-scroll" class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <RouterView v-slot="{ Component, route: r }">
        <KeepAlive :max="8">
          <component :is="Component" :key="r.fullPath" />
        </KeepAlive>
      </RouterView>
    </main>
    <BottomNav />
  </div>
</template>
