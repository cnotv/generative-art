<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <header class="header">
    <h1 class="text">Senior Frontend Developer</h1>
    <div class="filter"></div>
    <img src="./assets/sand2.jpg" alt="Sand" class="background-image" />
  </header>
  <div class="canvas">
    <HelloWorld />
  </div>
</template>

<style scoped>
.canvas {
  top: 0;
  opacity: 0.7;
  position: absolute;
}

.header {
  top: 0;
  position: absolute;
  width: 100%;
  text-align: center;
  height: 100%;
}

.text {
  font-size: 5em;
  color: #666;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
  filter: blur(1px);
}

.filter {
  position: absolute;
  background-color: #777;
  top: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: color;
}
</style>
