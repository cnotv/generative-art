<template>
  <div class="score">
    <span class="score__value">{{ getGameScore() }}</span>
    <span class="score__value score__value--highest">Best: {{ getHighestScore() }}</span>
  </div>
</template>

<script setup lang="ts">
import { gameState } from "@webgametoolkit/game";

const { getGameScore, getHighestScore } = gameState;
</script>

<style scoped>
@import "../styles.css";
</style>
