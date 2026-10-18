import { createRouter, createWebHistory } from 'vue-router'
import MobileAppLayout from '@/components/layout/MobileAppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useCoachStore } from '@/stores/coach'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: 'Sign in', public: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignUpView.vue'),
      meta: { title: 'Create account', public: true },
    },
    {
      path: '/invite/:token',
      name: 'guardian-invite',
      component: () => import('@/views/GuardianInviteView.vue'),
      props: true,
      meta: { title: 'Guardian invite', public: true, guardian: true },
    },
    {
      path: '/unavailable',
      name: 'profile-unavailable',
      component: () => import('@/views/ProfileUnavailableView.vue'),
      meta: { title: 'Profile unavailable' },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/CoachOnboardingView.vue'),
      meta: { title: 'Coach Onboarding' },
    },
    {
      path: '/',
      component: MobileAppLayout,
      redirect: '/ops',
      children: [
        { path: 'ops', name: 'ops', component: () => import('@/views/DailyOpsView.vue'), meta: { tab: 'ops' } },
        { path: 'cadets', name: 'cadets', component: () => import('@/views/CadetLinkHubView.vue'), meta: { tab: 'cadets' } },
        {
          path: 'cadets/:id',
          name: 'player-stats',
          component: () => import('@/views/PlayerStatsView.vue'),
          props: true,
          meta: { tab: 'cadets' },
        },
        { path: 'nets', name: 'nets', component: () => import('@/views/NetsTelemetryView.vue'), meta: { tab: 'nets' } },
        { path: 'tactics', name: 'tactics', component: () => import('@/views/TacticsView.vue'), meta: { tab: 'tactics' } },
        { path: 'showcase', name: 'showcase', component: () => import('@/views/TalentShowcaseView.vue'), meta: { tab: 'showcase' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/ops' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  // Guardians open invite links signed out or with an account that has no coach profile.
  if (to.meta.guardian) return true
  const coach = useCoachStore()

  if (!auth.user) {
    coach.reset()
    if (to.meta.public) return true
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }

  if (to.name === 'login' || to.name === 'signup') return { path: '/ops' }
  if (to.name === 'profile-unavailable') return true
  try {
    await coach.load(auth.user.id)
  } catch {
    return { name: 'profile-unavailable', query: { redirect: to.fullPath } }
  }
  if (!coach.hasProfile && to.name !== 'onboarding') return { name: 'onboarding' }
  return true
})

export default router
