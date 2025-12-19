import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'

const homePath = '/games/GoombaRunner';
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

// Add navigation guard to update page title
router.beforeEach((to, from, next) => {
  // Set page title based on route name
  if (to.name && typeof to.name === 'string') {
    document.title = `${to.name} | Generative Art`;
  } else {
    document.title = 'Generative Art';
  }
  
  next();
});

export default router
