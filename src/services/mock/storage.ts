import type { StorageService } from '../types'
import { toSquareDataUrl } from '@/lib/image'

/** Stand-in for a Supabase Storage `avatars` bucket; the returned data URL is stored on the profile. */
export function createMockStorageService(): StorageService {
  return {
    async uploadAvatar(_userId, file) {
      return toSquareDataUrl(file)
    },
    async removeAvatar() {
      /* nothing persisted outside the profile row */
    },
  }
}
