<template>
  <div class="loader-cube-scene" aria-hidden="true">
    <div class="loader-cube">
      <div class="loader-cube__face loader-cube__face--front" />
      <div class="loader-cube__face loader-cube__face--back" />
      <div class="loader-cube__face loader-cube__face--left" />
      <div class="loader-cube__face loader-cube__face--right" />
      <div class="loader-cube__face loader-cube__face--top" />
    </div>
  </div>
</template>

<style scoped>
.loader-cube-scene {
  perspective: 160px;
  width: 2.5rem;
  height: 2.5rem;
}

.loader-cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: loader-cube-spin 2s linear infinite;
}

.loader-cube__face {
  position: absolute;
  width: 2.5rem;
  height: 2.5rem;
  border: 1.5px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.loader-cube__face--front {
  transform: translateZ(1.25rem);
}

.loader-cube__face--back {
  transform: rotateY(180deg) translateZ(1.25rem);
}

.loader-cube__face--left {
  transform: rotateY(-90deg) translateZ(1.25rem);
  filter: brightness(0.6);
}

.loader-cube__face--right {
  transform: rotateY(90deg) translateZ(1.25rem);
  filter: brightness(0.6);
}

.loader-cube__face--top {
  transform: rotateX(-90deg) translateZ(1.25rem);
  filter: brightness(1.5);
}

@keyframes loader-cube-spin {
  from {
    transform: rotateX(-35.264deg) rotateY(45deg);
  }

  to {
    transform: rotateX(-35.264deg) rotateY(405deg);
  }
}
</style>
