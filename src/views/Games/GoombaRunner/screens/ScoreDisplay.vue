<template>
  <div class="score">
    <span class="score__value">{{ gameScore }}</span>
    <span class="score__value score__value--highest">Best: {{ highestScore }}</span>
  </div>
</template>

<script setup lang="ts">
import { gameScore, highestScore } from "../helpers/setup";
</script>

<style scoped>
@import "../styles.css";
</style>
