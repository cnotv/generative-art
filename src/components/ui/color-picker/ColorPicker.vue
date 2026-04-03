<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: string
  disabled?: boolean
  class?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = ref(props.modelValue ?? '#000000')
const colorInputReference = ref<HTMLInputElement | null>(null)

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

const handleClick = () => {
  if (!props.disabled && colorInputReference.value) {
    colorInputReference.value.click()
  }
}
</script>

<template>
  <div
    class="color-picker"
    :class="[$props.class, { 'color-picker--disabled': disabled }]"
    @click="handleClick"
  >
    <div class="color-picker__swatch" :style="{ backgroundColor: internalValue }" />
    <span class="color-picker__hex">{{ internalValue }}</span>
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
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}
</style>
