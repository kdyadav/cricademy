<script setup lang="ts">
import { ChevronDown, CircleDollarSign, Link2Off, StickyNote, Undo2 } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import type { AttendanceRecord, AttendanceStatus, Cadet } from '@/types'
import { ATTENDANCE_STATUS_OPTIONS, DRILL_FOCUS_OPTIONS, LATE_MINUTE_OPTIONS } from '@/data/options'
import { STATUS_STYLES } from './statusStyles'
import { cn } from '@/lib/cn'

const props = defineProps<{
  cadet: Cadet
  record?: AttendanceRecord
  locked: boolean
}>()
const expanded = defineModel<boolean>('expanded', { default: false })
const emit = defineEmits<{
  status: [status: AttendanceStatus]
  update: [patch: Partial<Omit<AttendanceRecord, 'cadetId'>>]
  clear: []
}>()

function pick(status: AttendanceStatus) {
  if (props.locked) return
  emit('status', status)
  if (status === 'late' || status === 'absent' || status === 'injured') expanded.value = true
}
</script>

<template>
  <li :class="cn('bg-card transition-colors', record && STATUS_STYLES[record.status].row)">
    <div class="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
        :aria-expanded="expanded"
        :aria-controls="`att-${cadet.id}`"
        @click="expanded = !expanded"
      >
        <span class="relative">
          <UiAvatar :name="cadet.name" :src="cadet.avatarUrl" size="md" />
          <span v-if="record" :class="cn('absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white', STATUS_STYLES[record.status].dot)" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5">
            <span class="truncate text-sm font-semibold">{{ cadet.name }}</span>
            <span class="text-[11px] text-ink-muted tabular-nums">#{{ cadet.jersey }}</span>
            <StickyNote v-if="record?.note" class="size-3 shrink-0 text-ink-muted" aria-label="Has note" />
          </span>
          <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
            {{ cadet.role }}
            <span v-if="record?.status === 'late'" class="font-semibold text-clay">· {{ record.lateMinutes }}m late</span>
            <span v-if="record?.excusedByParent" class="font-semibold text-turf-700">· Excused</span>
            <span v-if="cadet.feeDue" class="inline-flex items-center gap-0.5 rounded bg-cherry-soft px-1 font-semibold text-cherry">
              <CircleDollarSign class="size-3" /> ${{ cadet.feeDue }}
            </span>
            <span v-if="cadet.linkStatus !== 'linked'" class="inline-flex items-center gap-0.5 rounded bg-gold-soft px-1 font-semibold text-clay">
              <Link2Off class="size-3" /> {{ cadet.linkStatus === 'pending' ? 'Invite pending' : 'No guardian' }}
            </span>
          </span>
        </span>
        <ChevronDown :class="cn('size-4 shrink-0 text-ink-muted transition-transform', expanded && 'rotate-180')" />
      </button>

      <div class="flex shrink-0 gap-1" role="radiogroup" :aria-label="`Attendance for ${cadet.name}`">
        <button
          v-for="o in ATTENDANCE_STATUS_OPTIONS"
          :key="o.value"
          type="button"
          role="radio"
          :aria-checked="record?.status === o.value"
          :aria-label="o.label"
          :disabled="locked"
          :class="
            cn(
              'grid size-8 place-items-center rounded-lg border border-hairline bg-card text-xs font-bold text-ink-muted transition focus-visible:ring-2 focus-visible:ring-turf focus-visible:outline-none enabled:active:scale-95 disabled:cursor-not-allowed',
              record?.status === o.value && STATUS_STYLES[o.value].solid,
              locked && record?.status !== o.value && 'opacity-40',
            )
          "
          @click="pick(o.value)"
        >
          {{ o.short }}
        </button>
      </div>
    </div>

    <div v-if="expanded" :id="`att-${cadet.id}`" class="space-y-3 border-t border-dashed border-hairline px-4 pt-3 pb-4">
      <p v-if="!record" class="text-xs text-ink-muted">Mark attendance to log drills and notes.</p>
      <template v-else>
        <div v-if="record.status === 'late'">
          <p class="mb-1.5 text-[11px] font-semibold text-ink-muted">Minutes late</p>
          <div class="flex gap-1.5">
            <button
              v-for="m in LATE_MINUTE_OPTIONS"
              :key="m"
              type="button"
              :disabled="locked"
              :class="
                cn(
                  'rounded-full border border-hairline px-3 py-1 text-xs font-semibold tabular-nums transition disabled:opacity-50',
                  record.lateMinutes === m ? 'border-gold bg-gold text-ink' : 'bg-card hover:bg-app',
                )
              "
              @click="emit('update', { lateMinutes: m })"
            >
              {{ m === 30 ? '30+' : m }}m
            </button>
          </div>
        </div>

        <label v-if="record.status === 'absent'" class="flex items-center justify-between gap-3 text-sm">
          <span>
            <span class="block font-semibold">Excused by parent</span>
            <span class="block text-[11px] text-ink-muted">Guardian informed the academy in advance</span>
          </span>
          <input
            type="checkbox"
            class="size-5 accent-turf"
            :checked="record.excusedByParent ?? false"
            :disabled="locked"
            @change="emit('update', { excusedByParent: ($event.target as HTMLInputElement).checked })"
          />
        </label>

        <div>
          <label :for="`drill-${cadet.id}`" class="mb-1 block text-[11px] font-semibold text-ink-muted">Drill focus</label>
          <select
            :id="`drill-${cadet.id}`"
            class="field-input py-2.5 text-sm"
            :value="record.drillFocus"
            :disabled="locked"
            @change="emit('update', { drillFocus: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="d in DRILL_FOCUS_OPTIONS" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>

        <div>
          <label :for="`note-${cadet.id}`" class="mb-1 block text-[11px] font-semibold text-ink-muted">Coach note</label>
          <textarea
            :id="`note-${cadet.id}`"
            rows="2"
            maxlength="240"
            class="field-input resize-none py-2.5 text-sm"
            placeholder="e.g. Head falling over on drives"
            :value="record.note ?? ''"
            :disabled="locked"
            @input="emit('update', { note: ($event.target as HTMLTextAreaElement).value || undefined })"
          />
        </div>

        <button v-if="!locked" type="button" class="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-cherry" @click="emit('clear')">
          <Undo2 class="size-3.5" /> Clear mark
        </button>
      </template>
    </div>
  </li>
</template>
