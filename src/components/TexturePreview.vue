<script setup lang="ts">
interface Props {
  src: string;
  alt: string;
}

defineProps<Props>();
</script>

<template>
  <div class="texture-preview">
    <img
      :src="src"
      :alt="alt"
      class="texture-preview__image"
    />
    <slot />
  </div>
</template>

<style scoped>
.texture-preview {
  position: relative;
  min-width: 48px;
  min-height: 48px;
  max-width: 64px;
  max-height: 64px;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  flex-shrink: 0;

  /* Checkered background pattern for transparency */
  background-color: #e0e0e0;
  background-image:
    linear-gradient(45deg, #f5f5f5 25%, transparent 25%),
    linear-gradient(-45deg, #f5f5f5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f5f5f5 75%),
    linear-gradient(-45deg, transparent 75%, #f5f5f5 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.texture-preview__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  position: relative;
  z-index: 1;
  border-radius: inherit;
}
</style>
