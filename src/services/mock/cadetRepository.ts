import type { CadetRepository, InviteDelivery } from '../types'
import type { Cadet } from '@/types'
import { readCadets, writeCadets } from './cadetStore'
import { readSessions, writeSessions } from './telemetryRepository'

const INVITE_TTL_MS = 48 * 3_600_000

const DEMO_DELIVERY: InviteDelivery = { status: 'manual', link: null, reason: 'Demo mode saves the invite but cannot send messages.' }

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
    async create(_coachId, input) {
      await latency()
      const cadet: Cadet = { ...structuredClone(input), id: crypto.randomUUID(), linkStatus: 'unlinked' }
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
    },
    async sendGuardianInvite(cadetId, guardian) {
      await latency(500)
      const cadet = mutate(cadetId, (c) => ({
        ...c,
        linkStatus: 'pending',
        guardian: { ...guardian, verified: false },
        inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      }))
      return { cadet, delivery: DEMO_DELIVERY }
    },
    async resendGuardianInvite(cadetId) {
      await latency(500)
      const cadet = mutate(cadetId, (c) => {
        if (c.linkStatus !== 'pending') throw new Error('There is no pending invite to resend.')
        return { ...c, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString() }
      })
      return { cadet, delivery: DEMO_DELIVERY }
    },
    async unlinkGuardian(cadetId) {
      await latency()
      return mutate(cadetId, ({ guardian: _g, inviteExpiresAt: _e, ...c }) => ({ ...c, linkStatus: 'unlinked' }))
    },
  }
}
