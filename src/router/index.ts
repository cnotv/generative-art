import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '@/config/router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/1'
    },
    ...routes
  ]
})

export default router