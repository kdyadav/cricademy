// Sets a new temporary password for a username account in the caller's academy.
// Body: { academyId, userId }
// - The owner can reset coaches and guardians; a coach can reset guardians of cadets they manage.
// - Only accounts that belong to this academy alone can be reset here, so one academy cannot take over
//   a login that also has access to another academy. Those users reset their password themselves.
import { check, cors, getContext, json, temporaryPassword, USERNAME_EMAIL_DOMAIN } from '../_shared/members.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const ctx = await getContext(req)
  if (!ctx) return json({ error: 'Sign in again to reset passwords.' }, 401)
  const { user, userClient, admin } = ctx

  const { academyId, userId } = (await req.json().catch(() => ({}))) as { academyId?: string; userId?: string }
  if (!academyId || !userId) return json({ error: 'Missing academy or member.' }, 400)
  if (userId === user.id) return json({ error: 'Use "Change password" to update your own password.' }, 400)

  const { data: memberships } = await admin.from('academy_members').select('academy_id, role').eq('user_id', userId)
  const here = memberships?.find((m) => m.academy_id === academyId)
  if (!here || here.role === 'owner') return json({ error: 'Member not found.' }, 404)

  let allowed = await check(userClient, 'is_academy_owner', { p_academy: academyId })
  if (!allowed && here.role === 'guardian') {
    const { data: links } = await admin
      .from('cadet_guardians')
      .select('cadet_id, cadets!inner(academy_id)')
      .eq('guardian_id', userId)
      .eq('cadets.academy_id', academyId)
    for (const link of links ?? []) {
      if (await check(userClient, 'can_manage_cadet', { p_cadet: link.cadet_id })) {
        allowed = true
        break
      }
    }
  }
  if (!allowed) return json({ error: 'You cannot reset this member\'s password.' }, 403)

  if ((memberships ?? []).length > 1) {
    return json({ error: 'This person also belongs to another academy, so they must change their password themselves.' }, 409)
  }
  const { data: target } = await admin.auth.admin.getUserById(userId)
  if (!target.user?.email?.endsWith(`@${USERNAME_EMAIL_DOMAIN}`)) {
    return json({ error: 'This person signs in with their own email and can reset their password from the login page.' }, 409)
  }

  const password = temporaryPassword()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return json({ error: 'Could not reset the password.' }, 500)
  await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)

  return json({ temporaryPassword: password })
})
