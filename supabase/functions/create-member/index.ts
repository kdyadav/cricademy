// Adds a coach or guardian to an academy, creating a username login if the username is new.
// Body: { academyId, role: 'coach' | 'guardian', username, displayName?, cadetId?, relationship? }
// - Coaches: only the owner can add them. Guardians: any staff member can add them.
// - An existing user who is not yet a member is added as `pending` and must accept in the app.
// - With `cadetId`, the caller must manage that cadet and the guardian is linked to it (`pending` until accepted).
// New accounts get a temporary password (returned once, never stored) and must change it at first login.
import { check, cors, getContext, json, normalizeUsername, temporaryPassword, usernameEmail } from '../_shared/members.ts'

type Body = {
  academyId?: string
  role?: 'coach' | 'guardian'
  username?: string
  displayName?: string
  cadetId?: string
  relationship?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const ctx = await getContext(req)
  if (!ctx) return json({ error: 'Sign in again to add members.' }, 401)
  const { user, userClient, admin } = ctx

  const body = (await req.json().catch(() => ({}))) as Body
  const { academyId, role, cadetId } = body
  const username = normalizeUsername(body.username)
  const displayName = (body.displayName ?? '').trim().slice(0, 120)
  const relationship = (body.relationship ?? '').trim().slice(0, 40)
  if (!academyId || (role !== 'coach' && role !== 'guardian')) return json({ error: 'Missing academy or role.' }, 400)
  if (!username) {
    return json({ error: 'Usernames are 3 to 30 characters: letters, numbers, dots and underscores, starting with a letter or number.' }, 400)
  }
  if (role === 'coach' && cadetId) return json({ error: 'Only guardians can be linked to a cadet.' }, 400)

  const allowed =
    role === 'coach'
      ? await check(userClient, 'is_academy_owner', { p_academy: academyId })
      : await check(userClient, 'is_academy_staff', { p_academy: academyId })
  if (!allowed) return json({ error: role === 'coach' ? 'Only the academy owner can add coaches.' : 'You are not staff at this academy.' }, 403)

  if (cadetId) {
    const { data: cadet } = await admin.from('cadets').select('academy_id').eq('id', cadetId).maybeSingle()
    if (!cadet || cadet.academy_id !== academyId || !(await check(userClient, 'can_manage_cadet', { p_cadet: cadetId }))) {
      return json({ error: 'Cadet not found.' }, 404)
    }
  }

  // Find or create the account.
  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  let userId = existing?.id as string | undefined
  let password: string | undefined
  if (!userId) {
    password = temporaryPassword()
    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameEmail(username),
      password,
      email_confirm: true,
      app_metadata: { username, must_change_password: true },
      user_metadata: { display_name: displayName || username },
    })
    if (error || !created.user) {
      const taken = error?.message?.toLowerCase().includes('already')
      return json({ error: taken ? 'That username is taken.' : 'Could not create the account.' }, taken ? 409 : 500)
    }
    userId = created.user.id
  }
  if (userId === user.id) return json({ error: 'You are already a member of this academy.' }, 409)

  // Membership. New accounts are active straight away; existing users must accept first.
  const { data: member } = await admin
    .from('academy_members')
    .select('role, status')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .maybeSingle()
  let status = member?.status as 'active' | 'pending' | undefined
  if (member && member.role !== role) {
    return json({ error: `This person is already a ${member.role} at this academy.` }, 409)
  }
  if (!member) {
    status = password ? 'active' : 'pending'
    const { error } = await admin
      .from('academy_members')
      .insert({ academy_id: academyId, user_id: userId, role, status, invited_by: user.id })
    if (error) {
      if (password) await admin.auth.admin.deleteUser(userId)
      return json({ error: 'Could not add the member.' }, 500)
    }
  }

  if (cadetId) {
    const { error: linkError } = await admin
      .from('cadet_guardians')
      .upsert({ cadet_id: cadetId, guardian_id: userId, relationship }, { onConflict: 'cadet_id,guardian_id' })
    const { error: cadetError } = await admin
      .from('cadets')
      .update({ guardian_user_id: userId, link_status: status === 'active' ? 'linked' : 'pending', invite_expires_at: null })
      .eq('id', cadetId)
    if (linkError || cadetError) return json({ error: 'Account added, but linking to the cadet failed. Try again.' }, 500)
  }

  return json({
    userId,
    username,
    status,
    created: Boolean(password),
    ...(password ? { temporaryPassword: password } : {}),
  })
})
