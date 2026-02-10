<script setup lang="ts">
import { ref, watch } from 'vue';
import { cn } from '@/lib/utilities';

const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const internalValue = ref(props.modelValue ?? '#000000');
const colorInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== undefined) {
      internalValue.value = newValue;
    }
  }
);

const handleColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  internalValue.value = target.value;
  emit('update:modelValue', target.value);
};

const handleClick = () => {
  if (!props.disabled && colorInputRef.value) {
    colorInputRef.value.click();
  }
};

const presetColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff',
];

const selectPreset = (color: string) => {
  internalValue.value = color;
  emit('update:modelValue', color);
};
</script>

<template>
  <div
    :class="
      cn(
        'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors',
        disabled && 'cursor-not-allowed opacity-50',
        $props.class
      )
    "
    @click="handleClick"
  >
    <div
      class="h-5 w-5 rounded border flex-shrink-0"
      :style="{ backgroundColor: internalValue }"
    />
    <span class="font-mono text-xs flex-1">{{ internalValue }}</span>

    <!-- Hidden color input that opens native color picker -->
    <input
      ref="colorInputRef"
      type="color"
      :value="internalValue"
      :disabled="disabled"
      class="absolute opacity-0 pointer-events-none w-0 h-0"
      @input="handleColorChange"
    />
  </div>
</template>
