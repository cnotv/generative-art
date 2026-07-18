<script setup lang="ts">
import { computed } from 'vue'
import { ChevronUp, ChevronDown } from 'lucide-vue-next'
import type { LobbyConfigField } from '@/types/lobbyWizard'

const props = withDefaults(defineProps<{ field: LobbyConfigField; size?: 'sm' | 'md' }>(), {
  size: 'md'
})

const emit = defineEmits<{
  change: [key: string, value: string | number]
}>()

const onChange = (event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('change', props.field.key, props.field.type === 'number' ? Number(raw) : raw)
}

const selectedIndex = computed(() =>
  props.field.type === 'select'
    ? props.field.options.findIndex((option) => option.value === props.field.value)
    : -1
)

const canGoPrevious = computed(() => {
  if (props.field.type === 'select') return selectedIndex.value > 0
  return props.field.min === undefined || Number(props.field.value) > props.field.min
})

const canGoNext = computed(() => {
  if (props.field.type === 'select') {
    return selectedIndex.value < props.field.options.length - 1
  }
  return props.field.max === undefined || Number(props.field.value) < props.field.max
})

const showArrows = computed(() => canGoPrevious.value || canGoNext.value)
</script>

<template>
  <div class="lui-field" :class="`lui-field--${size}`">
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

    <span v-if="showArrows" class="lui-field__arrows" aria-hidden="true">
      <ChevronUp v-if="canGoPrevious" class="lui-field__arrow" />
      <ChevronDown v-if="canGoNext" class="lui-field__arrow" />
    </span>
  </div>
</template>

<style scoped>
.lui-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.lui-field__arrows {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.lui-field__arrow {
  width: 1.1em;
  height: 1.1em;
  pointer-events: none;
  opacity: 0.7;
  filter: drop-shadow(2px 2px 0 #000);
}

/* Mirrors .lui-btn: same border weight, sketchy radius and type treatment so a
   field sitting next to buttons reads as part of the same control family. */
.lui-field__control {
  padding-block: calc(var(--spacing-2) + 0.06em) calc(var(--spacing-2) - 0.06em);
  padding-inline: var(--spacing-4);
  border: 3px solid transparent;
  border-radius: var(--lui-radius-sketch);
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

.lui-field--sm .lui-field__control {
  padding-block: calc(var(--spacing-1) + 0.06em) calc(var(--spacing-1) - 0.06em);
  padding-inline: var(--spacing-2);
  font-size: var(--lui-text-small);
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
