// Sends one notification to every device the user turned on alerts for, using Web Push (VAPID).
// Called by the `dispatch_push` database trigger, not by the app. Deploy with --no-verify-jwt; the caller
// is checked with the `x-push-secret` header instead.
// Secrets: PUSH_WEBHOOK_SECRET (same value as the Vault secret `push_webhook_secret`), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and optional VAPID_SUBJECT (default `mailto:support@cricademy.app`).
// Body: { notification_id }
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'Unauthorized' }, 401)

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return json({ error: 'VAPID keys are not configured.' }, 500)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@cricademy.app', publicKey, privateKey)

  const { notification_id: id } = (await req.json().catch(() => ({}))) as { notification_id?: string }
  if (!id) return json({ error: 'Missing notification.' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: n } = await admin
    .from('notifications')
    .select('id, user_id, kind, title, body, url, tone')
    .eq('id', id)
    .maybeSingle()
  if (!n) return json({ error: 'Notification not found.' }, 404)

  const [{ data: subs }, { count: unread }] = await Promise.all([
    admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', n.user_id),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', n.user_id).is('read_at', null),
  ])
  if (!subs?.length) return json({ sent: 0, removed: 0 })

  const payload = JSON.stringify({ id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url ?? '/', unread: unread ?? 0 })
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60 * 24,
        urgency: n.tone === 'alert' ? 'high' : 'normal',
      }),
    ),
  )

  // 404/410 mean the browser dropped the subscription (app uninstalled or permission revoked).
  const gone = subs.filter((_, i) => {
    const r = results[i]
    const code = r.status === 'rejected' ? (r.reason as { statusCode?: number })?.statusCode : undefined
    if (r.status === 'rejected' && code !== 404 && code !== 410) console.error('Push failed', code ?? r.reason)
    return code === 404 || code === 410
  })
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone.map((s) => s.endpoint))

  return json({ sent: results.filter((r) => r.status === 'fulfilled').length, removed: gone.length })
})
