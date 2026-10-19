import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { membershipService, type Membership, type UserProfile } from '@/services'

const ACTIVE_KEY = 'cricademy:active-academy'

const ROLE_ORDER: Record<Membership['role'], number> = { owner: 0, coach: 1, guardian: 2 }

/** The signed-in user's profile, their academy memberships and the academy the app is showing. */
export const useAcademyStore = defineStore('academy', () => {
  const profile = ref<UserProfile | null>(null)
  const memberships = ref<Membership[]>([])
  const activeId = ref<string | null>(localStorage.getItem(ACTIVE_KEY))
  let loadedFor: string | null = null

  const activeMemberships = computed(() =>
    memberships.value.filter((m) => m.status === 'active').sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
  )
  const pending = computed(() => memberships.value.filter((m) => m.status === 'pending'))
  const active = computed(() => activeMemberships.value.find((m) => m.academyId === activeId.value) ?? null)
  const role = computed(() => active.value?.role ?? null)
  const isOwner = computed(() => role.value === 'owner')
  const isStaff = computed(() => role.value === 'owner' || role.value === 'coach')
  const isGuardian = computed(() => role.value === 'guardian')
  const mustChangePassword = computed(() => profile.value?.mustChangePassword ?? false)

  function select(academyId: string | null) {
    activeId.value = academyId
    if (academyId) localStorage.setItem(ACTIVE_KEY, academyId)
    else localStorage.removeItem(ACTIVE_KEY)
  }

  /** Keeps the stored academy when it is still active, otherwise picks the first by role. */
  async function load(userId: string, force = false) {
    if (!force && loadedFor === userId) return
    const [p, list] = await Promise.all([membershipService.getProfile(userId), membershipService.list(userId)])
    profile.value = p
    memberships.value = list
    loadedFor = userId
    if (!active.value) select(activeMemberships.value[0]?.academyId ?? null)
  }

  async function respond(userId: string, academyId: string, accept: boolean) {
    await membershipService.respond(academyId, accept)
    await load(userId, true)
    if (accept) select(academyId)
  }

  async function rename(academyId: string, name: string) {
    await membershipService.renameAcademy(academyId, name)
    memberships.value = memberships.value.map((m) => (m.academyId === academyId ? { ...m, academyName: name } : m))
  }

  function markPasswordChanged() {
    if (profile.value) profile.value = { ...profile.value, mustChangePassword: false }
  }

  function reset() {
    profile.value = null
    memberships.value = []
    loadedFor = null
  }

  return {
    profile,
    memberships,
    activeId,
    activeMemberships,
    pending,
    active,
    role,
    isOwner,
    isStaff,
    isGuardian,
    mustChangePassword,
    select,
    load,
    respond,
    rename,
    markPasswordChanged,
    reset,
  }
})
