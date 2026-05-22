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
        <div class="loading-overlay__spinner" aria-hidden="true" />
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

.loading-overlay__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: loading-spin 0.8s linear infinite;
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

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
