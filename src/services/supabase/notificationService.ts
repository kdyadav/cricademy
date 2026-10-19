import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification } from '@/types'
import type { NotificationService } from '../types'

/** Row shape of `public.notifications`. */
interface NotificationRow {
  id: string
  title: string
  body: string
  url: string | null
  tone: AppNotification['tone']
  read_at: string | null
  created_at: string
}

const COLUMNS = 'id, title, body, url, tone, read_at, created_at'

const fromRow = (r: NotificationRow): AppNotification => ({
  id: r.id,
  title: r.title,
  body: r.body,
  url: r.url ?? undefined,
  tone: r.tone,
  read: r.read_at !== null,
  createdAt: r.created_at,
})

export function createSupabaseNotificationService(client: SupabaseClient): NotificationService {
  return {
    pushAvailable: true,
    async list(limit = 50) {
      const { data, error } = await client
        .from('notifications')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<NotificationRow[]>()
      if (error) throw new Error('Could not load notifications.')
      return data.map(fromRow)
    },
    async markRead(ids) {
      if (!ids.length) return
      const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null)
      if (error) throw new Error('Could not update notifications.')
    },
    subscribe(userId, handler) {
      const channel = client
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => handler(fromRow(payload.new as NotificationRow)),
        )
        .subscribe()
      return () => {
        client.removeChannel(channel)
      }
    },
    async savePushSubscription({ endpoint, p256dh, auth, userAgent }) {
      const { error } = await client.rpc('save_push_subscription', {
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: userAgent,
      })
      if (error) throw new Error('Could not turn on alerts for this device.')
    },
    async removePushSubscription(endpoint) {
      const { error } = await client.from('push_subscriptions').delete().eq('endpoint', endpoint)
      if (error) throw new Error('Could not turn off alerts for this device.')
    },
  }
}
