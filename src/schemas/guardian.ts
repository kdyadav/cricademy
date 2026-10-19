import { z } from 'zod'
import { USERNAME_PATTERN } from '@/lib/username'

const EMAIL = z.string().email()
/** Optional leading +, then 8–15 digits with spaces or dashes. */
const PHONE = /^\+?[\d\s-]{8,20}$/
const isPhone = (v: string) => {
  const digits = v.replace(/\D/g, '').length
  return PHONE.test(v) && digits >= 8 && digits <= 15
}

export const guardianInviteSchema = z.object({
  name: z.string().trim().min(2, "Enter the guardian's full name").max(60, 'Keep it under 60 characters'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, '3 to 30 letters, numbers, dots or underscores, starting with a letter or number'),
  contact: z
    .string()
    .trim()
    .min(1, 'Enter a mobile number or email')
    .refine((v) => EMAIL.safeParse(v).success || isPhone(v), 'Enter a valid mobile number or email'),
  relationship: z.enum(['Mother', 'Father', 'Guardian', 'Sibling'], {
    errorMap: () => ({ message: 'Choose a relationship' }),
  }),
  permissions: z
    .array(z.enum(['fee_payer', 'attendance_signoff', 'view_only']))
    .min(1, 'Pick at least one permission')
    .refine((p) => !(p.includes('view_only') && p.length > 1), 'View only cannot be combined with other permissions'),
})

export type GuardianInviteFormInput = z.infer<typeof guardianInviteSchema>

/** `true` when the contact is an email address rather than a phone number. */
export const isEmailContact = (contact: string) => contact.includes('@')
