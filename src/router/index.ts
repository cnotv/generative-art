import { createRouter, createWebHistory } from 'vue-router'
import { generatedRoutes } from '@/config/router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Landing Page',
      component: () => import('@/views/Experiments/LandingPage/LandingPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: '/'
    },
    ...generatedRoutes.filter((r) => r !== null)
  ]
})

// Add navigation guard to update page title
router.beforeEach((to, _from, next) => {
  // Set page title based on route name
  if (to.name && typeof to.name === 'string') {
    document.title = `${to.name} | Generative Art`;
  } else {
    document.title = 'Generative Art';
  }
  
  next();
});

export default router
