<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: string
  disabled?: boolean
  hideValue?: boolean
  class?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = ref(props.modelValue ?? '#000000')

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== undefined) {
      internalValue.value = newValue
    }
  }
)

const handleColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  internalValue.value = target.value
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="color-picker" :class="[$props.class, { 'color-picker--disabled': disabled }]">
    <div class="color-picker__swatch" :style="{ backgroundColor: internalValue }" />
    <span v-if="!hideValue" class="color-picker__hex">{{ internalValue }}</span>
    <input
      ref="colorInputReference"
      type="color"
      :value="internalValue"
      :disabled="disabled"
      class="color-picker__input"
      @input="handleColorChange"
    />
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.color-picker--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.color-picker__swatch {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.color-picker__hex {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: hsl(var(--muted-foreground));
}

.color-picker__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border: none;
  padding: 0;
}
</style>
