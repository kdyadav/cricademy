import type { FeeDue, FeeSettings } from '@/types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** `1500` -> `₹1,500` */
export const formatInr = (amount: number) => inr.format(amount)

/** `2026-10-05` -> `5 Oct 2026` */
export const formatDueDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const isOverdue = (due: FeeDue, today: string) => due.status === 'due' && due.dueDate < today

/** Public page where the payer opens PhonePe and reports the UTR. */
export const payLink = (dueId: string) => `${window.location.origin}${import.meta.env.BASE_URL}pay/${dueId}`

/**
 * UPI deep link (NPCI spec). `scheme: 'phonepe'` opens PhonePe directly; `upi` lets the phone pick any UPI app.
 * `tr` carries the due id so the payment can be matched to it in the payee's statement.
 */
export function upiPayUrl(payee: FeeSettings, amount: number, note: string, ref: string, scheme: 'upi' | 'phonepe' = 'upi') {
  const params = new URLSearchParams({
    pa: payee.upiId,
    pn: payee.payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
    tr: ref.replace(/-/g, '').slice(0, 35),
  })
  return `${scheme}://pay?${params.toString().replace(/\+/g, '%20')}`
}

/** wa.me needs a full international number; bare 10-digit numbers are treated as Indian. */
export function whatsappNumber(contact: string) {
  let digits = contact.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return digits
}
