import { z } from 'zod'

export const UPI_ID = /^[A-Za-z0-9._-]{2,}@[A-Za-z0-9]{2,}$/

export const raiseFeesSchema = z.object({
  title: z.string().trim().min(2, 'Name this fee, e.g. October fees').max(60, 'Keep it under 60 characters'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Enter an amount')
    .max(1_000_000, 'Too large')
    .refine((n) => Number.isInteger(n * 100), 'Up to 2 decimal places'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a due date'),
  /** `all`, or a batch id */
  target: z.string().min(1, 'Choose who pays'),
})

export type RaiseFeesFormInput = z.infer<typeof raiseFeesSchema>

export const feeSettingsSchema = z.object({
  upiId: z.string().trim().max(100, 'UPI ID is too long').regex(UPI_ID, 'Enter a UPI ID like academy@ybl'),
  payeeName: z.string().trim().min(1, 'Enter the name parents will see').max(60, 'Keep it under 60 characters'),
})

export type FeeSettingsFormInput = z.infer<typeof feeSettingsSchema>
