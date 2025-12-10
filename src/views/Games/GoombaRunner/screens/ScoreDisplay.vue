<template>
  <div class="score">
    <span class="score__value">{{ gameState.data.score }}</span>
    <span class="score__value score__value--highest"
      >Best: {{ gameState.data.highestScore }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { gameState } from "../helpers/setup";
</script>

<style scoped>
@import "../styles.css";
</style>
