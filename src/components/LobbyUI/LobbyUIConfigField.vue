<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { LobbyConfigField } from '@/types/lobbyWizard'

const props = defineProps<{ field: LobbyConfigField }>()

const emit = defineEmits<{
  change: [key: string, value: string | number]
}>()

const onChange = (event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('change', props.field.key, props.field.type === 'number' ? Number(raw) : raw)
}
</script>

<template>
  <div class="lui-field">
    <ChevronLeft class="lui-field__arrow" aria-hidden="true" />

    <select
      v-if="field.type === 'select'"
      class="lui-field__control"
      :value="field.value"
      @change="onChange"
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
      @input="onChange"
    />

    <ChevronRight class="lui-field__arrow" aria-hidden="true" />
  </div>
</template>

<style scoped>
.lui-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.lui-field__arrow {
  width: 1.1em;
  height: 1.1em;
  pointer-events: none;
  opacity: 0.7;
  filter: drop-shadow(2px 2px 0 #000);
}

.lui-field__control {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  text-shadow: var(--lui-text-shadow);
  outline: none;
  appearance: none;
  text-align: center;
  cursor: pointer;
}

.lui-field__control--number {
  width: 4rem;
}

.lui-field__control:focus,
.lui-field__control:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
}

.lui-field__control option {
  color: #000;
  background: #fff;
  text-shadow: none;
}
</style>
