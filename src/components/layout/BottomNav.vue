<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IndianRupee, Users, UserCog } from 'lucide-vue-next'
import { useUiStore, TAB_ROOTS, type TabKey } from '@/stores/ui'
import { useAcademyStore } from '@/stores/academy'
import { cn } from '@/lib/cn'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const academy = useAcademyStore()

const tabs = computed<{ key: TabKey; label: string; icon: typeof Users }[]>(() =>
  academy.isOwner
    ? [
        { key: 'cadets', label: 'Cadets', icon: Users },
        { key: 'fees', label: 'Fees', icon: IndianRupee },
        { key: 'coaches', label: 'Coaches', icon: UserCog },
      ]
    : [],
)

const activeTab = computed(() => route.meta.tab as TabKey | undefined)

function go(tab: TabKey) {
  // Re-tapping the active tab pops back to its root; otherwise restore its last stack position
  if (activeTab.value === tab) {
    ui.resetTab(tab)
    router.push(TAB_ROOTS[tab])
  } else {
    router.push(ui.lastPathByTab[tab])
  }
}
</script>

<template>
  <nav v-if="tabs.length" class="relative z-30 shrink-0 border-t border-hairline bg-card pb-safe" aria-label="Primary">
    <ul class="grid grid-cols-3 px-1 pt-1.5">
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
