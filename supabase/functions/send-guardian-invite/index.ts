// Sends a guardian invite as an approved WhatsApp template through Meta's Cloud API.
// Secrets: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE (default `guardian_invite`),
// optional WHATSAPP_TEMPLATE_LANG (default `en`) and WHATSAPP_API_VERSION (default `v22.0`).
// Body params: {{1}} guardian, {{2}} coach, {{3}} cadet, {{4}} academy; URL button param {{1}} is the invite token.
// `hello_world` is sent without params so the pipeline can be tested before the real template is approved.
import { createClient } from 'npm:@supabase/supabase-js@2'

type Result = { status: 'sent' | 'manual' | 'failed'; reason?: string }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** WhatsApp expects country code + number, digits only. Ten-digit numbers are treated as Indian. */
function toWhatsAppNumber(contact: string) {
  let digits = contact.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: auth } = await userClient.auth.getUser()
  if (!auth.user) return json({ error: 'Sign in again to send invites.' }, 401)

  const { inviteId, token } = (await req.json().catch(() => ({}))) as { inviteId?: string; token?: string }
  if (!inviteId || !token) return json({ error: 'Missing invite.' }, 400)

  const { data: invite } = await admin
    .from('guardian_invites')
    .select('id, cadet_id, coach_id, token_hash, expires_at, accepted_at')
    .eq('id', inviteId)
    .maybeSingle()
  if (!invite || invite.coach_id !== auth.user.id || invite.token_hash !== (await sha256Hex(token))) {
    return json({ error: 'Invite not found.' }, 404)
  }
  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) return json({ error: 'This invite is no longer active.' }, 409)

  const [{ data: cadet }, { data: coach }] = await Promise.all([
    admin.from('cadets').select('name, guardian').eq('id', invite.cadet_id).single(),
    admin.from('coach_profiles').select('name, facility').eq('id', invite.coach_id).maybeSingle(),
  ])
  const guardian = (cadet?.guardian ?? {}) as { name?: string; contact?: string }

  const finish = async (result: Result, waMessageId?: string) => {
    await admin.from('guardian_invites').update({ delivery_status: result.status, wa_message_id: waMessageId ?? null }).eq('id', invite.id)
    return json(result)
  }

  const to = guardian.contact && !guardian.contact.includes('@') ? toWhatsAppNumber(guardian.contact) : null
  if (!to) return finish({ status: 'manual', reason: 'not_a_phone' })

  const waToken = Deno.env.get('WHATSAPP_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!waToken || !phoneNumberId) return finish({ status: 'manual', reason: 'not_configured' })

  const template = Deno.env.get('WHATSAPP_TEMPLATE') ?? 'guardian_invite'
  const isHelloWorld = template === 'hello_world'
  const text = (value: string) => ({ type: 'text', text: value.slice(0, 60) })
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: isHelloWorld ? 'en_US' : (Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'en') },
      ...(isHelloWorld
        ? {}
        : {
            components: [
              {
                type: 'body',
                parameters: [
                  text(guardian.name || 'there'),
                  text(coach?.name || 'Your coach'),
                  text(cadet?.name || 'your child'),
                  text(coach?.facility || 'the academy'),
                ],
              },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: token }] },
            ],
          }),
    },
  }

  const version = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v22.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = body?.error?.error_data?.details || body?.error?.message || `WhatsApp error ${res.status}`
    console.error('WhatsApp send failed', res.status, body?.error?.code)
    return finish({ status: 'failed', reason })
  }
  return finish({ status: 'sent' }, body?.messages?.[0]?.id)
})
