import type { SupabaseClient } from '@supabase/supabase-js'
import type { StorageService } from '../types'
import { toSquareJpeg } from '@/lib/image'

const BUCKET = 'avatars'

/** Avatars live at `avatars/<userId>/<timestamp>.jpg`; a fresh name per upload avoids stale CDN caches. */
export function createSupabaseStorageService(client: SupabaseClient): StorageService {
  const bucket = () => client.storage.from(BUCKET)

  async function clearFolder(userId: string, keep?: string) {
    const { data } = await bucket().list(userId)
    const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep)
    if (stale.length) await bucket().remove(stale)
  }

  return {
    async uploadAvatar(userId, file) {
      const path = `${userId}/${Date.now()}.jpg`
      const { error } = await bucket().upload(path, await toSquareJpeg(file), { contentType: 'image/jpeg', upsert: true })
      if (error) throw new Error('Could not upload the photo.')
      await clearFolder(userId, path)
      return bucket().getPublicUrl(path).data.publicUrl
    },
    async removeAvatar(userId) {
      await clearFolder(userId)
    },
  }
}
