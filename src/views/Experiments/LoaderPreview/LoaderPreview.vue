<script setup lang="ts">
import { ref } from 'vue'

const stage = ref('Loading assets…')
const detail = ref('mushroom.glb (3 / 12)')
</script>

<template>
  <div class="loader-preview">
    <div class="loader-preview__card">
      <div class="loader-preview__cube-scene" aria-hidden="true">
        <div class="loader-preview__cube">
          <div class="loader-preview__cube-face loader-preview__cube-face--front" />
          <div class="loader-preview__cube-face loader-preview__cube-face--right" />
          <div class="loader-preview__cube-face loader-preview__cube-face--top" />
        </div>
      </div>
      <p class="loader-preview__stage">{{ stage }}</p>
      <p class="loader-preview__detail">{{ detail }}</p>

      <div class="loader-preview__controls">
        <label class="loader-preview__label">
          Stage
          <input v-model="stage" class="loader-preview__input" type="text" />
        </label>
        <label class="loader-preview__label">
          Detail
          <input v-model="detail" class="loader-preview__input" type="text" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loader-preview {
  padding-top: var(--nav-height);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
}

.loader-preview__card {
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

.loader-preview__cube-scene {
  perspective: 120px;
  width: 2.5rem;
  height: 2.5rem;
}

.loader-preview__cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: cube-rotate-y 1.6s linear infinite;
}

.loader-preview__cube-face {
  position: absolute;
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.loader-preview__cube-face--front {
  transform: translateZ(1.25rem);
}

.loader-preview__cube-face--right {
  transform: rotateY(90deg) translateZ(1.25rem);
  filter: brightness(0.65);
}

.loader-preview__cube-face--top {
  transform: rotateX(90deg) translateZ(1.25rem);
  filter: brightness(1.4);
}

.loader-preview__stage {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-foreground);
}

.loader-preview__detail {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  max-width: 20rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loader-preview__controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  width: 100%;
  margin-top: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
  text-align: left;
}

.loader-preview__label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.loader-preview__input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
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
