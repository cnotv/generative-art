<script setup lang="ts">
import { ref } from 'vue'
import LoaderCube from '@/components/LoaderCube.vue'

const stage = ref('Loading assets…')
const detail = ref('mushroom.glb (3 / 12)')
</script>

<template>
  <div class="loader-preview">
    <div class="loader-preview__card">
      <LoaderCube />
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
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  padding-top: var(--spacing-8);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-width: 16rem;
  text-align: center;
}

.loader-preview__stage {
  margin: var(--spacing-4) 0 0;
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
</style>
