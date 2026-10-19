import { z } from 'zod'
import { USERNAME_PATTERN } from '@/lib/username'

export const signInSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'Enter your username or email')
    .refine((v) => (v.includes('@') ? z.string().email().safeParse(v).success : USERNAME_PATTERN.test(v.toLowerCase())), {
      message: 'Enter a valid username or email',
    }),
  password: z.string().min(6, 'At least 6 characters'),
})

export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z
  .object({
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export type SignUpInput = z.infer<typeof signUpSchema>

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const addMemberSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, '3 to 30 letters, numbers, dots or underscores, starting with a letter or number'),
  displayName: z.string().trim().max(120, 'At most 120 characters').optional(),
})

export type AddMemberFormInput = z.infer<typeof addMemberSchema>
