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

// Add navigation guard to update page title
router.beforeEach((to, from, next) => {
  // Set page title based on route name
  if (to.name && typeof to.name === 'string') {
    // Convert route name to a more readable title
    // e.g., "GoombaRunner" -> "Goomba Runner" or "CubeMatrix" -> "Cube Matrix"
    const title = to.name
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .trim() // Remove leading space
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
    
    document.title = `${title} | Generative Art`;
  } else {
    document.title = 'Generative Art';
  }
  
  next();
});

export default router
