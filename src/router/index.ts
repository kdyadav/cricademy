import { createRouter, createWebHistory } from 'vue-router'
import MobileAppLayout from '@/components/layout/MobileAppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useAcademyStore } from '@/stores/academy'
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
      path: '/pay/:id',
      name: 'fee-payment',
      component: () => import('@/views/FeePaymentView.vue'),
      props: true,
      meta: { title: 'Fee payment', public: true, guardian: true },
    },
    {
      path: '/unavailable',
      name: 'profile-unavailable',
      component: () => import('@/views/ProfileUnavailableView.vue'),
      meta: { title: 'Profile unavailable' },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue'),
      meta: { title: 'Change password' },
    },
    {
      path: '/academies',
      name: 'academies',
      component: () => import('@/views/AcademiesView.vue'),
      meta: { title: 'Academies' },
    },
    {
      path: '/home',
      name: 'guardian-home',
      component: () => import('@/views/GuardianHomeView.vue'),
      meta: { title: 'Home' },
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
        { path: 'ops', name: 'ops', component: () => import('@/views/DailyOpsView.vue'), meta: { tab: 'cadets' } },
        { path: 'cadets', name: 'cadets', component: () => import('@/views/CadetLinkHubView.vue'), meta: { tab: 'cadets' } },
        {
          path: 'cadets/:id',
          name: 'player-stats',
          component: () => import('@/views/PlayerStatsView.vue'),
          props: true,
          meta: { tab: 'cadets' },
        },
        { path: 'nets', name: 'nets', component: () => import('@/views/NetsTelemetryView.vue'), meta: { tab: 'cadets' } },
        { path: 'fees', name: 'fees', component: () => import('@/views/FeesView.vue'), meta: { tab: 'fees' } },
        { path: 'coaches', name: 'members', component: () => import('@/views/MembersView.vue'), meta: { tab: 'coaches' } },
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
  const academy = useAcademyStore()

  if (!auth.user) {
    coach.reset()
    academy.reset()
    if (to.meta.public) return true
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }

  if (to.name === 'login' || to.name === 'signup') return { path: '/ops' }
  if (to.name === 'profile-unavailable') return true
  const unavailable = { name: 'profile-unavailable', query: { redirect: to.fullPath } }
  try {
    await academy.load(auth.user.id)
  } catch {
    return unavailable
  }

  if (academy.mustChangePassword) return to.name === 'change-password' || { name: 'change-password' }
  if (to.name === 'change-password' || to.name === 'academies') return true
  if (!academy.active && academy.pending.length) return { name: 'academies' }

  if (academy.isGuardian) return to.name === 'guardian-home' || { name: 'guardian-home' }
  if (to.name === 'guardian-home') return { path: '/ops' }

  try {
    await coach.load(auth.user.id)
  } catch {
    return unavailable
  }
  // A first coach profile also creates the user's own academy, so onboarding comes before having one.
  if (!coach.hasProfile) return to.name === 'onboarding' || { name: 'onboarding' }
  if (!academy.active) return { name: 'academies' }
  if ((to.name === 'members' || to.name === 'fees') && !academy.isOwner) return { path: '/ops' }
  return true
})

export default router
