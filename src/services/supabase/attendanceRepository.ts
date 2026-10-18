import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendanceRepository, AttendanceSheet, NetBatchInput } from '../types'
import type { AgeGroup, AttendanceRecord, NetBatch } from '@/types'
import { cadetFromRow, type CadetRow } from './cadetRepository'

/** Row shape of `public.net_batches`. */
interface BatchRow {
  id: string
  label: string
  age_group: AgeGroup
  focus: string
  start_time: string
  end_time: string
  pitch: string
}

/** Row shape of `public.attendance_sheets`. */
interface SheetRow {
  batch_id: string
  date: string
  records: AttendanceRecord[]
  submitted_at: string | null
}

const batchFromRow = (r: BatchRow): NetBatch => ({
  id: r.id,
  label: r.label,
  ageGroup: r.age_group,
  focus: r.focus,
  start: r.start_time,
  end: r.end_time,
  pitch: r.pitch,
})

const batchToRow = (b: NetBatchInput) => ({
  label: b.label,
  age_group: b.ageGroup,
  focus: b.focus,
  start_time: b.start,
  end_time: b.end,
  pitch: b.pitch,
})

const sheetFromRow = (r: SheetRow): AttendanceSheet => ({
  batchId: r.batch_id,
  date: r.date,
  records: r.records ?? [],
  submittedAt: r.submitted_at,
})

export function createSupabaseAttendanceRepository(client: SupabaseClient): AttendanceRepository {
  return {
    async listBatches(coachId) {
      const { data, error } = await client
        .from('net_batches')
        .select('*')
        .eq('coach_id', coachId)
        .order('start_time')
        .returns<BatchRow[]>()
      if (error) throw new Error('Could not load net batches.')
      return data.map(batchFromRow)
    },
    async createBatch(coachId, input) {
      const { data, error } = await client
        .from('net_batches')
        .insert({ ...batchToRow(input), coach_id: coachId })
        .select('*')
        .single<BatchRow>()
      if (error) throw new Error('Could not add the batch.')
      return batchFromRow(data)
    },
    async updateBatch(batch) {
      const { data, error } = await client
        .from('net_batches')
        .update(batchToRow(batch))
        .eq('id', batch.id)
        .select('*')
        .single<BatchRow>()
      if (error) throw new Error('Could not save the batch.')
      return batchFromRow(data)
    },
    async deleteBatch(batchId) {
      const { error } = await client.from('net_batches').delete().eq('id', batchId)
      if (error) throw new Error('Could not delete the batch.')
    },
    async listCadets(batchId) {
      const { data, error } = await client.from('cadets').select('*').eq('batch_id', batchId).order('name').returns<CadetRow[]>()
      if (error) throw new Error('Could not load this batch.')
      return data.map(cadetFromRow)
    },
    async getSheet(batchId, date) {
      const { data, error } = await client
        .from('attendance_sheets')
        .select('batch_id, date, records, submitted_at')
        .eq('batch_id', batchId)
        .eq('date', date)
        .maybeSingle<SheetRow>()
      if (error) throw new Error('Could not load the register.')
      return data ? sheetFromRow(data) : null
    },
    async saveSheet(sheet) {
      const { data, error } = await client
        .from('attendance_sheets')
        .upsert(
          { batch_id: sheet.batchId, date: sheet.date, records: sheet.records, submitted_at: sheet.submittedAt },
          { onConflict: 'batch_id,date' },
        )
        .select('batch_id, date, records, submitted_at')
        .single<SheetRow>()
      if (error) throw new Error('Could not save the register.')
      return sheetFromRow(data)
    },
  }
}
