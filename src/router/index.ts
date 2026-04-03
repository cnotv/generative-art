import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/Experiments/LandingPage/LandingPage.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: '/experiments/LandingPage'
    },
    ...generatedRoutes.filter((r) => r !== null)
  ]
})

const getPageTitle = (name: string | null | symbol): string => {
  if (name && typeof name === 'string') {
    return `${name} | Generative Art`
  }
  return 'Generative Art'
}

router.beforeEach((to, _from, next) => {
  document.title = getPageTitle(to.name)
  next()
})

export default router
