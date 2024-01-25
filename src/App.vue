<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress);
});

const handleKeyPress = (event: KeyboardEvent) => {
  const name = router.currentRoute.value.name
  const page = name ? +name.toString() : 0;

  switch (event.key) {
    case 'ArrowRight': {
      if (page < 2) router.push(`/${page + 1}`);
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
