import type { SupabaseClient } from '@supabase/supabase-js'
import type { FeePaymentService, FeeRepository } from '../types'
import type { FeeDue, FeeStatus, PaymentMethod } from '@/types'

/** Row shape of `public.fee_dues` (see supabase/migrations). */
interface FeeDueRow {
  id: string
  cadet_id: string
  title: string
  amount: number | string
  due_date: string
  status: FeeStatus
  paid_at: string | null
  method: PaymentMethod | null
  reference: string | null
  reported_reference: string | null
  reported_at: string | null
  reminded_at: string | null
}

const fromRow = (r: FeeDueRow): FeeDue => ({
  id: r.id,
  cadetId: r.cadet_id,
  title: r.title,
  amount: Number(r.amount),
  dueDate: r.due_date,
  status: r.status,
  paidAt: r.paid_at ?? undefined,
  method: r.method ?? undefined,
  reference: r.reference ?? undefined,
  reportedReference: r.reported_reference ?? undefined,
  reportedAt: r.reported_at ?? undefined,
  remindedAt: r.reminded_at ?? undefined,
})

export function createSupabaseFeeRepository(client: SupabaseClient): FeeRepository {
  async function patch(dueId: string, values: Partial<Omit<FeeDueRow, 'id'>>, failure: string) {
    const { data, error } = await client.from('fee_dues').update(values).eq('id', dueId).select('*').single<FeeDueRow>()
    if (error) throw new Error(failure)
    return fromRow(data)
  }

  return {
    async getSettings(academyId) {
      const { data, error } = await client
        .from('fee_settings')
        .select('upi_id, payee_name')
        .eq('academy_id', academyId)
        .maybeSingle<{ upi_id: string; payee_name: string }>()
      if (error) throw new Error('Could not load payment settings.')
      return data ? { upiId: data.upi_id, payeeName: data.payee_name } : null
    },
    async saveSettings(academyId, s) {
      const { error } = await client.from('fee_settings').upsert({ academy_id: academyId, upi_id: s.upiId, payee_name: s.payeeName })
      if (error) throw new Error('Could not save payment settings.')
      return { ...s }
    },
    async list(academyId) {
      const { data, error } = await client
        .from('fee_dues')
        .select('*')
        .eq('academy_id', academyId)
        .order('due_date', { ascending: false })
        .returns<FeeDueRow[]>()
      if (error) throw new Error('Could not load fees.')
      return data.map(fromRow)
    },
    async create(academyId, cadetIds, input) {
      const rows = cadetIds.map((cadetId) => ({
        academy_id: academyId,
        cadet_id: cadetId,
        title: input.title,
        amount: input.amount,
        due_date: input.dueDate,
      }))
      const { data, error } = await client.from('fee_dues').insert(rows).select('*').returns<FeeDueRow[]>()
      if (error) throw new Error('Could not raise the fees.')
      return data.map(fromRow)
    },
    markPaid(dueId, { method, reference }) {
      return patch(
        dueId,
        { status: 'paid', paid_at: new Date().toISOString(), method, reference: reference?.trim() || null },
        'Could not record the payment.',
      )
    },
    setStatus(dueId, status) {
      return patch(dueId, { status, paid_at: null, method: null, reference: null }, 'Could not update the fee.')
    },
    markReminded(dueId) {
      return patch(dueId, { reminded_at: new Date().toISOString() }, 'Could not update the fee.')
    },
    async remove(dueId) {
      const { error } = await client.from('fee_dues').delete().eq('id', dueId)
      if (error) throw new Error('Could not delete the fee.')
    },
  }
}

export function createSupabaseFeePaymentService(client: SupabaseClient): FeePaymentService {
  return {
    async preview(dueId) {
      const { data, error } = await client
        .rpc('get_fee_payment', { p_due_id: dueId })
        .maybeSingle<{
          status: FeeStatus
          title: string
          amount: number | string
          due_date: string
          cadet_name: string
          payee_name: string | null
          upi_id: string | null
          reported: boolean
        }>()
      // An id that is not a UUID is rejected by Postgres; treat it as unknown.
      if (error?.code === '22P02') return null
      if (error) throw new Error('Could not load this payment.')
      if (!data) return null
      return {
        status: data.status,
        title: data.title,
        amount: Number(data.amount),
        dueDate: data.due_date,
        cadetName: data.cadet_name,
        payee: data.upi_id && data.payee_name ? { upiId: data.upi_id, payeeName: data.payee_name } : null,
        reported: data.reported,
      }
    },
    async report(dueId, reference) {
      const { error } = await client.rpc('report_fee_payment', { p_due_id: dueId, p_reference: reference })
      if (error) throw new Error(error.message || 'Could not send the payment details.')
    },
  }
}
