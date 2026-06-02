<script setup lang="ts">
type Option = { value: string; label: string }

defineProps<{
  modelValue: string
  options: Option[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="lui-toggle">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="lui-toggle__btn"
      :class="{ 'lui-toggle__btn--active': modelValue === opt.value }"
      type="button"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.lui-toggle {
  display: flex;
  gap: var(--spacing-2);
}

.lui-toggle__btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid transparent;
  border-radius: var(--radius-md, 0.5rem);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  text-shadow: var(--lui-text-shadow);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: border-color 0.15s ease;
}

.lui-toggle__btn--active {
  border-color: var(--lui-stroke);
  box-shadow: var(--lui-border-shadow);
}

.lui-toggle__btn:focus,
.lui-toggle__btn:focus-visible {
  outline: none;
  border-color: var(--lui-focus-color);
  color: var(--lui-focus-color);
}
</style>
