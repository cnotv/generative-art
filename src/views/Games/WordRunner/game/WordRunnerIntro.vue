<script setup lang="ts">
defineProps<{
  touch: boolean
}>()
</script>

<template>
  <!-- Passes every touch through to the course and its buttons, where a tap starts the race. -->
  <div class="word-runner-intro">
    <p class="word-runner-intro__prompt lui-slide-in">
      <span class="word-runner-intro__pulse lui-pulse">
        {{ touch ? 'Tap to start' : 'Press any key to start' }}
      </span>
    </p>
  </div>
</template>

<style scoped>
.word-runner-intro {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  pointer-events: none;
}

.word-runner-intro__prompt {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  color: var(--lui-focus-color);
  text-shadow: var(--lui-text-shadow);
  text-align: center;
  text-transform: uppercase;
}

.word-runner-intro__pulse {
  display: inline-block;
}
</style>
