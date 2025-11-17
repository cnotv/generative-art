<template>
  <div class="game game--over game--slide-in">
    <h1 class="game__title game__title--slide-in">Game Over</h1>
    <div v-if="isNewHighScore" class="new-high-score new-high-score--slide-in">
      <div class="gratz-text">New High Score: {{ gameScore }}</div>
    </div>
    <button
      @click="$emit('restart')"
      class="game__button game__button--button game__button--slide-in"
    >
      Press SPACEBAR or TAP to Restart
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  gameScore: number
  isNewHighScore: boolean
}>()

defineEmits<{
  restart: []
}>()
</script>

<style scoped>
@import '../styles.css';

.game--over {
  justify-content: center;
}

/* Slide-in animation from bottom for game over screen */
.game--slide-in {
  animation: slideInFromBottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.game__title--slide-in {
  animation: slideInFromBottom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s backwards;
}

.new-high-score--slide-in {
  animation: slideInFromBottom 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s backwards;
}

.game__button--slide-in {
  animation: slideInFromBottom 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s backwards;
}

@keyframes slideInFromBottom {
  0% {
    transform: translateY(100vh);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.game--over .game__title {
  font-size: 12vh;
  font-weight: 900;
  margin-bottom: 1rem;
  text-transform: uppercase;
  font-family: var(--font-playful);
  line-height: 0.6;
  letter-spacing: -0.4rem;
  color: var(--color-mario-red);
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -4px -4px 0 #000,
    4px -4px 0 var(--color-text), -4px 4px 0 var(--color-text),
    4px 4px 0 var(--color-text), -4px 0 0 var(--color-text), 4px 0 0 var(--color-text),
    0 -4px 0 var(--color-text), 0 4px 0 var(--color-text), var(--shadow-text-mario-large);
}

.gratz-text {
  font-size: 3rem;
  font-weight: 900;
  color: var(--color-mario-gold);
  font-family: var(--font-playful);
  text-shadow: var(--shadow-text-mario-large);
  animation: bounce 0.8s ease-in-out infinite;
  margin-bottom: 0.5rem;
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
</style>
