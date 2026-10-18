import { z } from 'zod'

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/

export const batchScheduleSchema = z
  .object({
    id: z.string(),
    label: z.string().trim().min(2, 'Name this batch').max(40, 'Keep it under 40 characters'),
    start: z.string().regex(TIME_24H, 'Pick a start time'),
    end: z.string().regex(TIME_24H, 'Pick an end time'),
  })
  .refine((s) => s.end > s.start, { message: 'Must end after it starts', path: ['end'] })

export const coachProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(60, 'Keep it under 60 characters'),
  accreditation: z.enum(['ECB_L3', 'BCCI_L2', 'CA_HP'], {
    errorMap: () => ({ message: 'Choose your accreditation' }),
  }),
  disciplines: z.array(z.enum(['batting', 'pace', 'spin', 'keeping'])).min(1, 'Pick at least one discipline'),
  facility: z.string().trim().min(2, 'Enter your home facility'),
  pitch: z.string().trim().min(1, 'Enter your primary pitch or net'),
  schedules: z.array(batchScheduleSchema).min(1, 'Add at least one batch').max(6, 'Up to 6 batches'),
})

export type BatchScheduleInput = z.infer<typeof batchScheduleSchema>
export type CoachProfileInput = z.infer<typeof coachProfileSchema>
