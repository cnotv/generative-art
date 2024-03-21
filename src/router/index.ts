import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'

const homePath = generatedRoutes[0].path;
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: homePath
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: homePath
    },
    ...generatedRoutes
  ]
})

export default router