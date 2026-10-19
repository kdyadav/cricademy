/** Must match `supabase/functions/_shared/members.ts`. */
export const USERNAME_EMAIL_DOMAIN = 'users.cricademy.app'
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,29}$/

/** Username accounts sign in with `<username>@users.cricademy.app`; anything with an `@` is used as an email. */
export function loginEmail(login: string) {
  const value = login.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${USERNAME_EMAIL_DOMAIN}`
}
