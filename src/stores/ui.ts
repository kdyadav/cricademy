import { reactive } from 'vue'
import { defineStore } from 'pinia'

export type TabKey = 'cadets' | 'fees' | 'coaches'

export const TAB_ROOTS: Record<TabKey, string> = {
  cadets: '/ops',
  fees: '/fees',
  coaches: '/coaches',
}

export const useUiStore = defineStore('ui', () => {
  /** Last visited path per bottom-nav tab, so re-tapping a tab restores its stack. */
  const lastPathByTab = reactive<Record<TabKey, string>>({ ...TAB_ROOTS })

  function rememberPath(tab: TabKey, path: string) {
    lastPathByTab[tab] = path
  }

  function resetTab(tab: TabKey) {
    lastPathByTab[tab] = TAB_ROOTS[tab]
  }

  return { lastPathByTab, rememberPath, resetTab }
})
