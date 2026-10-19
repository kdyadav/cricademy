import type { MembershipService } from '../types'
import { ACADEMY } from '@/data/mock'

/**
 * Demo mode has one academy per user, owned by that user. Its id is the user id,
 * which is also the key the mock repositories store data under.
 */
export function createMockMembershipService(): MembershipService {
  return {
    async getProfile(userId) {
      return { id: userId, username: null, displayName: '', mustChangePassword: false }
    },
    async list(userId) {
      return [{ academyId: userId, academyName: ACADEMY.name, role: 'owner', status: 'active' }]
    },
    async respond() {
      throw new Error('Academy invitations need Supabase.')
    },
    async renameAcademy() {
      throw new Error('Renaming the academy needs Supabase.')
    },
    async listMembers() {
      return []
    },
    async addMember() {
      throw new Error('Adding members needs Supabase.')
    },
    async removeMember() {
      throw new Error('Removing members needs Supabase.')
    },
    async resetPassword() {
      throw new Error('Resetting passwords needs Supabase.')
    },
    async listBatchCoaches() {
      return []
    },
    async setBatchCoach() {
      throw new Error('Assigning coaches needs Supabase.')
    },
  }
}
