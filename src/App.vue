<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'
import { generatedRoutes } from '@/config/router'

const router = useRouter()

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress);
});

const handleKeyPress = (event: KeyboardEvent) => {
  const { name, query } = router.currentRoute.value;
  const page = typeof name === 'string'  ? generatedRoutes.map(route => route.name).indexOf(name) : 0;
  
  switch (event.key) {
    case 'ArrowRight': {
      const path = generatedRoutes[page + 1]?.path;
      if (page < generatedRoutes.length - 1) router.push({query, path});
      break;
    }

    case 'ArrowLeft': {
      const path = generatedRoutes[page - 1]?.path;
      if (page > 0) router.push({query, path});
      break;
    }

    case 'ArrowUp': {
      toggleQuery('record');
      break;
    }

    case 'ArrowDown': {
      toggleQuery(['control', 'stats']);
      break;
    }
  
    default:
      break;
  }
};

const toggleQuery = (param: string | string[]) => {
  const { path, query } = router.currentRoute.value;
  const params = typeof param === 'string' ? [param] : param;
  const newQuery = params.reduce((acc, key) => ({ ...acc, [key]: query[key] === 'true' ? undefined : 'true' }), {})
  router.push({ path, query: { ...query,  ...newQuery } });
}

</script>

<template>
  <RouterView />
</template>

<style>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
