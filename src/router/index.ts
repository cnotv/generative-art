import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'
import { VIEW_META } from '@/config/viewsMeta'
import { updatePageMeta } from '@/utils/pageMeta'

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
  const name = typeof to.name === 'string' ? to.name : null
  const title = getPageTitle(name)
  document.title = title

  const viewMeta = name ? VIEW_META[name] : undefined
  updatePageMeta({
    title,
    description: viewMeta?.description,
    image: viewMeta?.image
  })

  next()
})

export default router
