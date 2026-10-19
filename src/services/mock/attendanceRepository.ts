import type { AttendanceRepository, AttendanceSheet, CadetAttendanceEntry } from '../types'
import type { NetBatch } from '@/types'
import { mockBatches } from '@/data/mock'
import { newId } from '@/lib/id'
import { readCadets, writeCadets } from './cadetStore'
import { readSessions, writeSessions } from './telemetryRepository'

const STORAGE_KEY = 'cricademy:attendance'
const BATCHES_KEY = 'cricademy:batches'

function readBatches(): NetBatch[] {
  try {
    const raw = localStorage.getItem(BATCHES_KEY)
    if (raw) return JSON.parse(raw) as NetBatch[]
  } catch {
    /* corrupt storage falls back to seed data */
  }
  return structuredClone(mockBatches)
}

const writeBatches = (batches: NetBatch[]) => localStorage.setItem(BATCHES_KEY, JSON.stringify(batches))
const byStart = (a: NetBatch, b: NetBatch) => a.start.localeCompare(b.start)

const latency = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))
const keyOf = (batchId: string, date: string) => `${batchId}:${date}`

function readAll(): Record<string, AttendanceSheet> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, AttendanceSheet>
  } catch {
    /* corrupt storage starts empty */
  }
  return {}
}

/** localStorage-backed stand-in for the Supabase `net_batches`, `cadets` and `attendance_sheets` tables. */
export function createMockAttendanceRepository(): AttendanceRepository {
  return {
    async listBatches() {
      await latency()
      return readBatches().sort(byStart)
    },
    async createBatch(_academyId, input) {
      await latency()
      const batch: NetBatch = { ...input, id: newId() }
      writeBatches([...readBatches(), batch])
      return structuredClone(batch)
    },
    async updateBatch(batch) {
      await latency()
      const all = readBatches()
      if (!all.some((b) => b.id === batch.id)) throw new Error('Batch not found.')
      writeBatches(all.map((b) => (b.id === batch.id ? batch : b)))
      return structuredClone(batch)
    },
    async deleteBatch(batchId) {
      await latency()
      writeBatches(readBatches().filter((b) => b.id !== batchId))
      writeCadets(readCadets().map((c) => (c.batchId === batchId ? { ...c, batchId: '' } : c)))
      writeSessions(readSessions().map((s) => (s.batchId === batchId ? { ...s, batchId: '' } : s)))
      const sheets = readAll()
      for (const key of Object.keys(sheets)) if (sheets[key]!.batchId === batchId) delete sheets[key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets))
    },
    async listCadets(batchId) {
      await latency()
      return readCadets().filter((c) => c.batchId === batchId)
    },
    async getSheet(batchId, date) {
      await latency()
      return readAll()[keyOf(batchId, date)] ?? null
    },
    async saveSheet(sheet) {
      await latency()
      const all = readAll()
      all[keyOf(sheet.batchId, sheet.date)] = sheet
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      return structuredClone(sheet)
    },
    async listCadetAttendance(cadetId, limit = 30) {
      await latency()
      const entries: CadetAttendanceEntry[] = []
      for (const s of Object.values(readAll())) {
        const r = s.submittedAt ? s.records.find((x) => x.cadetId === cadetId) : undefined
        if (r) entries.push({ date: s.date, batchId: s.batchId, status: r.status, lateMinutes: r.lateMinutes, note: r.note })
      }
      return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
    },
  }
}
