<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'
import { routes } from '@/config/router'

const router = useRouter()

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress);
});

const handleKeyPress = (event: KeyboardEvent) => {
  const path = router.currentRoute.value.path
  const page = path ? +path.toString().replace('/', '') : 0;
  
  switch (event.key) {
    case 'ArrowRight': {
      if (page < routes.length) router.push(`/${page + 1}`);
      break;
    }

    case 'ArrowLeft': {
      if (page > 1) router.push(`/${page - 1}`);
      break;
    }
  
    default:
      break;
  }
};

</script>

<template>
  <RouterView />
</template>

<style scoped>
</style>
