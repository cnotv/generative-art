<script setup lang="ts">
import LoaderCube from '@/components/LoaderCube.vue'

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
        <LoaderCube />
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
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  padding-top: var(--spacing-8);
  min-width: 16rem;
  text-align: center;
}

.loading-overlay__stage {
  margin: var(--spacing-4) 0 0;
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
</style>
