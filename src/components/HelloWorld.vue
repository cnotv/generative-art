<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { init } from "../utils/generate.js";
const statsEl = ref(null)
const canvas = ref(null)

onMounted(() => {
  init(canvas.value, statsEl.value)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div ref="statsEl"></div>
</template>

<style scoped>
</style>
