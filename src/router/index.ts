import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'
import { VIEW_META } from '@/config/viewsMeta'
import { updatePageMeta } from '@/utils/pageMeta'

const INITIAL_PAGE_PATH = '/tools/RigAnimator'
const HOME_TITLE = 'Generative Art'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: INITIAL_PAGE_PATH
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: INITIAL_PAGE_PATH
    },
    ...generatedRoutes.filter((r) => r !== null)
  ]
})

// Mirrors `ogImage` in scripts/routes.mjs: the capture written by scripts/capture.mjs
const ogImage = (path: string): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}og${path}.jpg`

const getPageTitle = (name: string | null | symbol): string => {
  if (name && typeof name === 'string') return name
  return HOME_TITLE
}

router.beforeEach((to, _from, next) => {
  const name = typeof to.name === 'string' ? to.name : null
  const title = getPageTitle(name)
  document.title = title

  const viewMeta = name ? VIEW_META[name] : undefined
  updatePageMeta({
    title,
    description: viewMeta?.description,
    image: viewMeta?.image ?? (name ? ogImage(to.path) : undefined)
  })

  next()
})

export default router
