import { createRouter, createWebHistory } from 'vue-router'
import SimplexWorker from '@/views/SimplexWorker/index.vue'
import SimplexCached from '@/views/SimplexCached/index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/1'
    },
    {
      path: '/1',
      name: '1',
      component: SimplexWorker
    },
    {
      path: '/2',
      name: '2',
      component: SimplexCached
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router
