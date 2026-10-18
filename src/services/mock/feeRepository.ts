import type { FeePaymentService, FeeRepository } from '../types'
import type { FeeDue, FeeSettings } from '@/types'
import { newId } from '@/lib/id'
import { readCadets, writeCadets } from './cadetStore'

const DUES_KEY = 'cricademy:fee-dues'
const SETTINGS_KEY = 'cricademy:fee-settings'

const latency = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* corrupt storage falls back to the default */
  }
  return fallback
}

/** Seeded cadets carry a `feeDue` amount; turn each into an opening-balance due once. */
function readDues(): FeeDue[] {
  const stored = read<FeeDue[] | null>(DUES_KEY, null)
  if (stored) return stored
  const today = new Date().toISOString().slice(0, 10)
  const seeded = readCadets()
    .filter((c) => c.feeDue > 0)
    .map((c): FeeDue => ({ id: newId(), cadetId: c.id, title: 'Opening balance', amount: c.feeDue, dueDate: today, status: 'due' }))
  localStorage.setItem(DUES_KEY, JSON.stringify(seeded))
  return seeded
}

/** Mirrors the `fee_dues` trigger that keeps `cadets.fee_due` equal to the open dues. */
function writeDues(dues: FeeDue[]) {
  localStorage.setItem(DUES_KEY, JSON.stringify(dues))
  const open = new Map<string, number>()
  for (const d of dues) if (d.status === 'due') open.set(d.cadetId, (open.get(d.cadetId) ?? 0) + d.amount)
  writeCadets(readCadets().map((c) => ({ ...c, feeDue: open.get(c.id) ?? 0 })))
}

/** Mirrors `on delete cascade` from `cadets`. */
export function removeCadetDues(cadetId: string) {
  const dues = read<FeeDue[] | null>(DUES_KEY, null)
  if (dues) localStorage.setItem(DUES_KEY, JSON.stringify(dues.filter((d) => d.cadetId !== cadetId)))
}

function update(dueId: string, change: (d: FeeDue) => FeeDue) {
  const dues = readDues()
  const i = dues.findIndex((d) => d.id === dueId)
  if (i < 0) throw new Error('This fee no longer exists.')
  dues[i] = change(dues[i]!)
  writeDues(dues)
  return dues[i]!
}

export function createMockFeeRepository(): FeeRepository {
  return {
    async getSettings() {
      await latency()
      return read<FeeSettings | null>(SETTINGS_KEY, null)
    },
    async saveSettings(_coachId, settings) {
      await latency()
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      return { ...settings }
    },
    async list() {
      await latency()
      return readDues().sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    },
    async create(_coachId, cadetIds, input) {
      await latency()
      const created = cadetIds.map((cadetId): FeeDue => ({ id: newId(), cadetId, ...input, status: 'due' }))
      writeDues([...readDues(), ...created])
      return created
    },
    async markPaid(dueId, { method, reference }) {
      await latency()
      return update(dueId, (d) => ({ ...d, status: 'paid', paidAt: new Date().toISOString(), method, reference: reference?.trim() || undefined }))
    },
    async setStatus(dueId, status) {
      await latency()
      return update(dueId, (d) => ({ ...d, status, paidAt: undefined, method: undefined, reference: undefined }))
    },
    async markReminded(dueId) {
      return update(dueId, (d) => ({ ...d, remindedAt: new Date().toISOString() }))
    },
    async remove(dueId) {
      await latency()
      writeDues(readDues().filter((d) => d.id !== dueId))
    },
  }
}

/** Demo pay page: reads the same browser storage, so it only works on the coach's device. */
export function createMockFeePaymentService(): FeePaymentService {
  return {
    async preview(dueId) {
      await latency()
      const due = readDues().find((d) => d.id === dueId)
      if (!due) return null
      return {
        status: due.status,
        title: due.title,
        amount: due.amount,
        dueDate: due.dueDate,
        cadetName: readCadets().find((c) => c.id === due.cadetId)?.name ?? 'Cadet',
        payee: read<FeeSettings | null>(SETTINGS_KEY, null),
        reported: !!due.reportedAt,
      }
    },
    async report(dueId, reference) {
      await latency()
      const ref = reference.replace(/\s/g, '').toUpperCase()
      if (!/^[A-Z0-9]{6,40}$/.test(ref)) throw new Error('Enter the UPI transaction ID (UTR) from your payment app')
      const due = readDues().find((d) => d.id === dueId)
      if (!due || due.status !== 'due') throw new Error('This fee is no longer open for payment')
      update(dueId, (d) => ({ ...d, reportedReference: ref, reportedAt: new Date().toISOString() }))
    },
  }
}
