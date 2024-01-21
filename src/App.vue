<script setup lang="ts">
import SimplexWorker from './components/SimplexWorker/index.vue'
import SimplexCached from './components/SimplexCached/index.vue'
const style = 2;
</script>

<template>
  <SimplexWorker v-if="style === 1" />
  <SimplexCached v-if="style === 2" />
</template>

<style scoped>
</style>
