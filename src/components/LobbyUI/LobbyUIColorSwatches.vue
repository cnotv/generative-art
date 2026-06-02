<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineProps<{
  modelValue: string
  colors: readonly string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="lui-swatches">
    <button
      v-for="color in colors"
      :key="color"
      class="lui-swatch"
      :class="{ 'lui-swatch--active': modelValue === color }"
      :style="{ background: color }"
      type="button"
      :title="`Pick color ${color}`"
      @click="emit('update:modelValue', color)"
      @touchend.prevent="emit('update:modelValue', color)"
    >
      <Check v-if="modelValue === color" class="lui-swatch__check" />
    </button>
  </div>
</template>

<style scoped>
.lui-swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.lui-swatch {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 0.1s ease;
}

.lui-swatch:hover {
  transform: scale(1.15);
}

.lui-swatch:focus,
.lui-swatch:focus-visible {
  outline: none;
  transform: scale(1.15);
  border-color: var(--lui-focus-color);
}

.lui-swatch--active {
  border-color: var(--lui-stroke);
}

.lui-swatch__check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}
</style>
