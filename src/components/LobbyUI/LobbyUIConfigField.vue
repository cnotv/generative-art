<script setup lang="ts">
import type { LobbyConfigField } from '@/types/lobbyWizard'

defineProps<{ field: LobbyConfigField }>()

const emit = defineEmits<{
  change: [key: string, value: string | number]
}>()

const onChange = (field: LobbyConfigField, event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('change', field.key, field.type === 'number' ? Number(raw) : raw)
}
</script>

<template>
  <select
    v-if="field.type === 'select'"
    class="lui-field__control"
    :value="field.value"
    @change="onChange(field, $event)"
  >
    <option
      v-for="opt in field.options"
      :key="opt.value"
      :value="opt.value"
      :selected="opt.value === field.value"
    >
      {{ opt.label }}
    </option>
  </select>
  <input
    v-else
    class="lui-field__control lui-field__control--number"
    type="number"
    :value="field.value"
    :min="field.min"
    :max="field.max"
    @input="onChange(field, $event)"
  />
</template>

<style scoped>
.lui-field__control {
  padding: var(--spacing-1) 0;
  border: none;
  border-bottom: 2px solid var(--lui-stroke-faint);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  text-shadow: var(--lui-text-shadow);
  outline: none;
  appearance: none;
  text-align: right;
  transition: border-color 0.15s ease;
}

.lui-field__control--number {
  width: 4rem;
}

.lui-field__control:hover,
.lui-field__control:focus,
.lui-field__control:focus-visible {
  border-bottom-color: var(--lui-stroke);
}

.lui-field__control:focus,
.lui-field__control:focus-visible {
  outline: 3px solid #ffd700;
  outline-offset: 4px;
}

.lui-field__control option {
  color: #000;
  background: #fff;
  text-shadow: none;
}
</style>
