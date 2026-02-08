<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue';
import { cn } from '@/lib/utilities';

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
  'update:modelValue': [value: number[]];
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
