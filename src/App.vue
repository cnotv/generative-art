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
  const { path, query } = router.currentRoute.value;
  const page = path ? +path.toString().replace('/', '') : 0;
  
  switch (event.key) {
    case 'ArrowRight': {
      const path = `/${page + 1}`;
      if (page < routes.length) router.push({query, path});
      break;
    }

    case 'ArrowLeft': {
      const path = `/${page - 1}`;
      if (page > 1) router.push({query, path});
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
