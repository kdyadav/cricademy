import type { NotificationService } from '../types'
import { mockNotifications } from '@/data/mock'

/** Demo mode keeps the sample notifications in memory; push needs a server, so it is unavailable. */
export function createMockNotificationService(): NotificationService {
  const items = structuredClone(mockNotifications)
  return {
    pushAvailable: false,
    async list(limit = 50) {
      return structuredClone(items.slice(0, limit))
    },
    async markRead(ids) {
      items.forEach((n) => {
        if (ids.includes(n.id)) n.read = true
      })
    },
    subscribe() {
      return () => {}
    },
    async savePushSubscription() {
      throw new Error('Phone alerts need Supabase.')
    },
    async removePushSubscription() {},
  }
}
