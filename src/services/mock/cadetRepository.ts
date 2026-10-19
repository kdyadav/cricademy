import type { CadetRepository } from '../types'
import type { Cadet } from '@/types'
import { newId } from '@/lib/id'
import { removeCadetDues } from './feeRepository'
import { readCadets, writeCadets } from './cadetStore'
import { readSessions, writeSessions } from './telemetryRepository'

const latency = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

function mutate(cadetId: string, fn: (cadet: Cadet) => Cadet): Cadet {
  const all = readCadets()
  const i = all.findIndex((c) => c.id === cadetId)
  const current = all[i]
  if (!current) throw new Error('Cadet not found.')
  const next = fn(current)
  all[i] = next
  writeCadets(all)
  return structuredClone(next)
}

/** localStorage-backed stand-in for the Supabase `cadets` and `guardian_links` tables. */
export function createMockCadetRepository(): CadetRepository {
  return {
    async list() {
      await latency()
      return readCadets()
    },
    async create(_academyId, input) {
      await latency()
      const cadet: Cadet = { ...structuredClone(input), id: newId(), linkStatus: 'unlinked', feeDue: 0 }
      writeCadets([...readCadets(), cadet])
      return structuredClone(cadet)
    },
    async update(cadetId, input) {
      await latency()
      return mutate(cadetId, (c) => ({ ...c, ...structuredClone(input) }))
    },
    async remove(cadetId) {
      await latency()
      writeCadets(readCadets().filter((c) => c.id !== cadetId))
      writeSessions(readSessions().filter((s) => s.cadetId !== cadetId))
      removeCadetDues(cadetId)
    },
    async addGuardian(_academyId, cadetId, guardian) {
      await latency(500)
      const cadet = mutate(cadetId, ({ inviteExpiresAt: _e, ...c }) => ({
        ...c,
        linkStatus: 'pending',
        guardian: { ...guardian, verified: false },
      }))
      return { cadet, member: null }
    },
    async unlinkGuardian(cadetId) {
      await latency()
      return mutate(cadetId, ({ guardian: _g, inviteExpiresAt: _e, ...c }) => ({ ...c, linkStatus: 'unlinked' }))
    },
  }
}
