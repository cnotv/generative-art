<template>
  <div class="game game--start">
    <h1 class="game__title">
      <span v-for="(item, i) in 'Goomba Runner'" :key="i" class="drift-char">
        {{ item.trim() }}
      </span>
    </h1>
    <button @click="$emit('start')" class="game__button game__button--start">
      Press SPACEBAR or TAP to Start
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  start: []
}>()
</script>

<style scoped>
@import '../styles.css';

.game--start .game__title {
  font-size: 12vh;
  font-weight: 900;
  margin-bottom: 1rem;
  text-shadow: var(--shadow-text-mario-large);
  text-transform: uppercase;
  font-family: var(--font-playful);
  color: var(--color-text);
  line-height: 0.6;
  letter-spacing: -0.4rem;
  /* Text outline using webkit-text-stroke */
  -webkit-text-stroke: 3px #fff;
  /* Fallback text outline using multiple text shadows */
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -4px -4px 0 #000,
    4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, -4px 0 0 #000, 4px 0 0 #000,
    0 -4px 0 #000, 0 4px 0 #000, var(--shadow-text-mario-large);
}

.game--start .game__title > span {
  color: var(--color-mario-red);
  display: inline-block;
  transition: transform 0.3s ease;
}

.game--start .game__title > span:nth-child(4n + 1) {
  color: var(--color-mario-red);
  --char-rotation: -3deg;
}

.game--start .game__title > span:nth-child(4n + 2) {
  color: var(--color-mario-blue);
  --char-rotation: 2deg;
}

.game--start .game__title > span:nth-child(4n + 3) {
  color: var(--color-mario-green);
  --char-rotation: -1deg;
}

.game--start .game__title > span:nth-child(4n + 4) {
  color: var(--color-mario-gold);
  --char-rotation: 4deg;
}

.game--start .game__title > span:empty {
  display: block;
}

/* Drifting animation for start screen characters */
.drift-char {
  animation-duration: 1s;
  animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  animation-fill-mode: backwards;
}

.drift-char:nth-child(1) {
  animation: driftFromLeft 1s 0.05s backwards;
}
.drift-char:nth-child(2) {
  animation: driftFromRight 1s 0.1s backwards;
}
.drift-char:nth-child(3) {
  animation: driftFromTop 1s 0.15s backwards;
}
.drift-char:nth-child(4) {
  animation: driftFromBottom 1s 0.2s backwards;
}
.drift-char:nth-child(5) {
  animation: driftFromLeft 1s 0.25s backwards;
}
.drift-char:nth-child(6) {
  animation: driftFromRight 1s 0.3s backwards;
}
.drift-char:nth-child(7) {
  animation: driftFromTop 1s 0.35s backwards;
}
.drift-char:nth-child(8) {
  animation: driftFromBottom 1s 0.4s backwards;
}
.drift-char:nth-child(9) {
  animation: driftFromLeft 1s 0.45s backwards;
}
.drift-char:nth-child(10) {
  animation: driftFromRight 1s 0.5s backwards;
}
.drift-char:nth-child(11) {
  animation: driftFromTop 1s 0.55s backwards;
}
.drift-char:nth-child(12) {
  animation: driftFromBottom 1s 0.6s backwards;
}
.drift-char:nth-child(13) {
  animation: driftFromLeft 1s 0.65s backwards;
}

@keyframes driftFromLeft {
  0% {
    transform: translateX(-100vw) rotate(-45deg) scale(0.3);
    opacity: 0;
  }
  70% {
    transform: translateX(10px) rotate(5deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateX(0) rotate(var(--char-rotation, 0deg)) scale(1);
    opacity: 1;
  }
}

@keyframes driftFromRight {
  0% {
    transform: translateX(100vw) rotate(45deg) scale(0.3);
    opacity: 0;
  }
  70% {
    transform: translateX(-10px) rotate(-5deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateX(0) rotate(var(--char-rotation, 0deg)) scale(1);
    opacity: 1;
  }
}

@keyframes driftFromTop {
  0% {
    transform: translateY(-100vh) rotate(-30deg) scale(0.3);
    opacity: 0;
  }
  70% {
    transform: translateY(10px) rotate(3deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateY(0) rotate(var(--char-rotation, 0deg)) scale(1);
    opacity: 1;
  }
}

@keyframes driftFromBottom {
  0% {
    transform: translateY(100vh) rotate(30deg) scale(0.3);
    opacity: 0;
  }
  70% {
    transform: translateY(-10px) rotate(-3deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateY(0) rotate(var(--char-rotation, 0deg)) scale(1);
    opacity: 1;
  }
}
</style>
