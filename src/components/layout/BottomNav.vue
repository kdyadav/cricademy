<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarCheck, Users, Activity, Shield, Trophy } from 'lucide-vue-next'
import { useUiStore, type TabKey } from '@/stores/ui'
import { cn } from '@/lib/cn'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'ops', label: 'Ops', icon: CalendarCheck },
  { key: 'cadets', label: 'Cadets', icon: Users },
  { key: 'nets', label: 'Nets', icon: Activity },
  { key: 'tactics', label: 'Tactics', icon: Shield },
  { key: 'showcase', label: 'Showcase', icon: Trophy },
]

const activeTab = computed(() => route.meta.tab as TabKey | undefined)

function go(tab: TabKey) {
  // Re-tapping the active tab pops back to its root; otherwise restore its last stack position
  if (activeTab.value === tab) {
    ui.resetTab(tab)
    router.push(`/${tab}`)
  } else {
    router.push(ui.lastPathByTab[tab])
  }
}
</script>

<template>
  <nav class="relative z-30 shrink-0 border-t border-hairline bg-card pb-safe" aria-label="Primary">
    <ul class="grid grid-cols-5 px-1 pt-1.5">
      <li v-for="t in tabs" :key="t.key">
        <button
          :class="
            cn(
              'group flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium text-ink-muted transition',
              activeTab === t.key && 'font-semibold text-ink',
            )
          "
          :aria-current="activeTab === t.key ? 'page' : undefined"
          @click="go(t.key)"
        >
          <span
            :class="
              cn(
                'grid h-7 w-12 place-items-center rounded-full transition',
                activeTab === t.key ? 'bg-turf-900 text-white' : 'group-hover:bg-app',
              )
            "
          >
            <component :is="t.icon" class="size-[18px]" :stroke-width="activeTab === t.key ? 2.4 : 2" />
          </span>
          {{ t.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>
