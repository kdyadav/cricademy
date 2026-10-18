import { reactive } from 'vue'
import { defineStore } from 'pinia'

export type TabKey = 'ops' | 'cadets' | 'nets' | 'tactics' | 'showcase'

export const useUiStore = defineStore('ui', () => {
  /** Last visited path per bottom-nav tab, so re-tapping a tab restores its stack. */
  const lastPathByTab = reactive<Record<TabKey, string>>({
    ops: '/ops',
    cadets: '/cadets',
    nets: '/nets',
    tactics: '/tactics',
    showcase: '/showcase',
  })

  function rememberPath(tab: TabKey, path: string) {
    lastPathByTab[tab] = path
  }

  function resetTab(tab: TabKey) {
    lastPathByTab[tab] = `/${tab}`
  }

  return { lastPathByTab, rememberPath, resetTab }
})
