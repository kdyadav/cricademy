import { z } from 'zod'

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/
const AGE_GROUP = z.enum(['U-14', 'U-16', 'U-19'], { errorMap: () => ({ message: 'Choose an age group' }) })

export const netBatchSchema = z
  .object({
    label: z.string().trim().min(2, 'Name this batch').max(60, 'Keep it under 60 characters'),
    ageGroup: AGE_GROUP,
    focus: z.string().trim().max(80, 'Keep it under 80 characters'),
    start: z.string().regex(TIME_24H, 'Pick a start time'),
    end: z.string().regex(TIME_24H, 'Pick an end time'),
    pitch: z.string().trim().max(60, 'Keep it under 60 characters'),
  })
  .refine((b) => b.end > b.start, { message: 'Must end after it starts', path: ['end'] })

export type NetBatchFormInput = z.infer<typeof netBatchSchema>

export const cadetSchema = z.object({
  name: z.string().trim().min(2, "Enter the cadet's full name").max(80, 'Keep it under 80 characters'),
  jersey: z.coerce
    .number({ invalid_type_error: 'Enter a jersey number' })
    .int('Whole numbers only')
    .min(0, '0–999')
    .max(999, '0–999'),
  ageGroup: AGE_GROUP,
  role: z.enum(['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'], { errorMap: () => ({ message: 'Choose a role' }) }),
  battingHand: z.enum(['Right', 'Left']),
  bowlingStyle: z.string().trim().max(40, 'Keep it under 40 characters').optional(),
  batchId: z.string(),
})

export type CadetFormInput = z.infer<typeof cadetSchema>

