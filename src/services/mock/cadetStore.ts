import type { Cadet } from '@/types'
import { mockCadets } from '@/data/mock'

const STORAGE_KEY = 'cricademy:cadets'

/** Shared localStorage stand-in for the Supabase `cadets` table, used by every mock repository. */
export function readCadets(): Cadet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Cadet[]
  } catch {
    /* corrupt storage falls back to seed data */
  }
  return structuredClone(mockCadets)
}

export function writeCadets(cadets: Cadet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cadets))
}
