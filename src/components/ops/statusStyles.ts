import type { Component } from 'vue'
import { Bandage, Check, Clock, X } from 'lucide-vue-next'
import type { AttendanceStatus } from '@/types'

/** Visual tokens per attendance status: `solid` for the selected button, `soft` for tiles, `row` for list tints. */
export const STATUS_STYLES: Record<AttendanceStatus, { icon: Component; solid: string; soft: string; row: string; dot: string }> = {
  present: { icon: Check, solid: 'bg-turf text-white border-turf', soft: 'bg-mint text-turf-700', row: 'bg-mint/40', dot: 'bg-turf' },
  late: { icon: Clock, solid: 'bg-gold text-ink border-gold', soft: 'bg-gold-soft text-clay', row: 'bg-gold-soft/50', dot: 'bg-gold' },
  absent: { icon: X, solid: 'bg-cherry text-white border-cherry', soft: 'bg-cherry-soft text-cherry', row: 'bg-cherry-soft/50', dot: 'bg-cherry' },
  injured: { icon: Bandage, solid: 'bg-ink text-white border-ink', soft: 'bg-app text-ink', row: 'bg-app', dot: 'bg-ink' },
}
