<script setup lang="ts">
defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleChange = (event: Event): void => {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <label class="lui-private">
    <input
      type="checkbox"
      class="lui-private__native"
      :checked="modelValue"
      @change="handleChange"
    />
    <span class="lui-private__box" :class="{ 'lui-private__box--checked': modelValue }" />
  </label>
</template>

<style scoped>
.lui-private {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.lui-private__native {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.lui-private__box {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--lui-stroke);
  border-radius: var(--lui-radius-sketch-small);
  box-shadow: var(--lui-border-shadow);
  background: transparent;
  flex-shrink: 0;
  transition: background 0.1s ease;
}

.lui-private__box--checked {
  background: var(--lui-stroke);
}

.lui-private__native:focus + .lui-private__box,
.lui-private__native:focus-visible + .lui-private__box {
  outline: none;
  border-color: var(--lui-focus-color);
}

.lui-private__native:focus + .lui-private__box.lui-private__box--checked,
.lui-private__native:focus-visible + .lui-private__box.lui-private__box--checked {
  background: var(--lui-focus-color);
}
</style>
