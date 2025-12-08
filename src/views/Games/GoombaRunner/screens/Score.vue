<template>
  <div class="score">
    <span class="score__value">{{ getGameScore() }}</span>
    <span class="score__value score__value--highest">Best: {{ getHighestScore() }}</span>
  </div>
</template>

<script setup lang="ts">
import { getGameScore, getHighestScore } from "../composables/useGameScore";
</script>

<style scoped>
@import "../styles.css";
</style>
