import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CoachProfile } from '@/types'
import type { CoachProfileInput } from '@/schemas/coach'
import { coachRepository, storageService } from '@/services'
import { useAuthStore } from './auth'

export const useCoachStore = defineStore('coach', () => {
  /** null until loaded, or when the signed-in user has not onboarded yet. */
  const profile = ref<CoachProfile | null>(null)
  const loadedForUserId = ref<string | null>(null)
  const coachModeActive = ref(true)

  const hasProfile = computed(() => profile.value !== null)

  async function load(userId: string) {
    if (loadedForUserId.value === userId) return
    profile.value = await coachRepository.getByUserId(userId)
    loadedForUserId.value = userId
  }

  /** `avatar`: a File to upload, `null` to remove the photo, `undefined` to keep the current one. */
  async function saveProfile(input: CoachProfileInput, avatar?: File | null) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not signed in')
    const userId = auth.user.id

    let avatarUrl = profile.value?.avatarUrl
    if (avatar) {
      avatarUrl = await storageService.uploadAvatar(userId, avatar)
    } else if (avatar === null && avatarUrl) {
      await storageService.removeAvatar(userId)
      avatarUrl = undefined
    }

    const saved = await coachRepository.upsert({ ...input, id: userId, avatarUrl })
    profile.value = saved
    loadedForUserId.value = auth.user.id
    return saved
  }

  function reset() {
    profile.value = null
    loadedForUserId.value = null
  }

  return {
    profile,
    hasProfile,
    coachModeActive,
    load,
    saveProfile,
    reset,
  }
})
