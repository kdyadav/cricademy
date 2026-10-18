import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})

export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = signInSchema
  .extend({ confirmPassword: z.string().min(1, 'Re-enter your password') })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export type SignUpInput = z.infer<typeof signUpSchema>
