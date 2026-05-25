<script setup lang="ts">
defineProps<{
  visible: boolean
  stage?: string
  detail?: string
}>()
</script>

<template>
  <Transition name="loading-overlay">
    <div v-if="visible" class="loading-overlay" aria-live="polite" aria-label="Loading">
      <div class="loading-overlay__content">
        <div class="loading-overlay__cube-scene" aria-hidden="true">
          <div class="loading-overlay__cube">
            <div class="loading-overlay__cube-face loading-overlay__cube-face--front" />
            <div class="loading-overlay__cube-face loading-overlay__cube-face--right" />
            <div class="loading-overlay__cube-face loading-overlay__cube-face--top" />
          </div>
        </div>
        <p class="loading-overlay__stage">{{ stage }}</p>
        <p v-if="detail" class="loading-overlay__detail">{{ detail }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 100);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 70%);
  backdrop-filter: blur(4px);
}

.loading-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-width: 16rem;
  text-align: center;
}

.loading-overlay__cube-scene {
  perspective: 120px;
  width: 2.5rem;
  height: 2.5rem;
}

.loading-overlay__cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: cube-rotate-y 1.6s linear infinite;
}

.loading-overlay__cube-face {
  position: absolute;
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.loading-overlay__cube-face--front {
  transform: translateZ(1.25rem);
}

.loading-overlay__cube-face--right {
  transform: rotateY(90deg) translateZ(1.25rem);
  filter: brightness(0.65);
}

.loading-overlay__cube-face--top {
  transform: rotateX(90deg) translateZ(1.25rem);
  filter: brightness(1.4);
}

.loading-overlay__stage {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-foreground);
}

.loading-overlay__detail {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  max-width: 20rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-overlay-enter-active,
.loading-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.loading-overlay-enter-from,
.loading-overlay-leave-to {
  opacity: 0;
}

@keyframes cube-rotate-y {
  from {
    transform: rotateX(-25deg) rotateY(0deg);
  }

  to {
    transform: rotateX(-25deg) rotateY(360deg);
  }
}
</style>
