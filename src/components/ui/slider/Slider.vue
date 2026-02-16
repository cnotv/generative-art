<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from "radix-vue";
import { cn } from "@/lib/utilities";

const props = defineProps<{
  modelValue?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number[]];
}>();
</script>

<template>
  <SliderRoot
    :model-value="modelValue"
    :default-value="defaultValue ?? [0]"
    :min="min ?? 0"
    :max="max ?? 100"
    :step="step ?? 1"
    :disabled="disabled"
    :class="cn('slider', props.class)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SliderTrack class="slider__track">
      <SliderRange class="slider__range" />
    </SliderTrack>
  </SliderRoot>
</template>

<style>
.slider {
  position: relative;
  display: flex;
  width: 100%;
  touch-action: none;
  user-select: none;
  align-items: center;
}

.slider__track {
  position: relative;
  height: 0.5rem;
  width: 100%;
  flex-grow: 1;
  overflow: hidden;
  border-radius: var(--radius-full);
  background-color: var(--color-secondary);
}

.slider__range {
  position: absolute;
  height: 100%;
  background-color: var(--color-primary);
}

.slider__thumb {
  display: block;
  height: 1.25rem;
  width: 1.25rem;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-primary);
  background-color: var(--color-background);
  transition: colors 150ms;
}

.slider__thumb:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.slider__thumb:disabled {
  pointer-events: none;
  opacity: 0.5;
}
</style>
