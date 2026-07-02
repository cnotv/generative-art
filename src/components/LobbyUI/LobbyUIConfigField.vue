<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import LobbyUIIconButton from './LobbyUIIconButton.vue'
import type { LobbyConfigField } from '@/types/lobbyWizard'

const props = defineProps<{ field: LobbyConfigField }>()

const emit = defineEmits<{
  change: [key: string, value: string | number]
}>()

const selectIndex = computed((): number => {
  if (props.field.type !== 'select') return -1
  return props.field.options.findIndex((option) => option.value === props.field.value)
})

const displayValue = computed((): string => {
  if (props.field.type === 'number') return String(props.field.value)
  return props.field.options[selectIndex.value]?.label ?? ''
})

const previousDisabled = computed((): boolean =>
  props.field.type === 'number' ? props.field.value <= props.field.min : selectIndex.value <= 0
)

const nextDisabled = computed((): boolean =>
  props.field.type === 'number'
    ? props.field.value >= props.field.max
    : selectIndex.value >= props.field.options.length - 1
)

const step = (delta: number): void => {
  if (props.field.type === 'number') {
    const next = Math.min(Math.max(props.field.value + delta, props.field.min), props.field.max)
    if (next !== props.field.value) emit('change', props.field.key, next)
    return
  }
  const index = Math.min(Math.max(selectIndex.value + delta, 0), props.field.options.length - 1)
  emit('change', props.field.key, props.field.options[index].value)
}
</script>

<template>
  <div class="lui-field">
    <LobbyUIIconButton
      size="sm"
      :disabled="previousDisabled"
      :title="`Previous ${field.label}`"
      @click="step(-1)"
    >
      <ChevronLeft class="lui-field__arrow" />
    </LobbyUIIconButton>

    <span class="lui-field__value">{{ displayValue }}</span>

    <LobbyUIIconButton
      size="sm"
      :disabled="nextDisabled"
      :title="`Next ${field.label}`"
      @click="step(1)"
    >
      <ChevronRight class="lui-field__arrow" />
    </LobbyUIIconButton>
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
  filter: drop-shadow(2px 2px 0 #000);
}

.lui-field__value {
  min-width: 6rem;
  text-align: center;
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}
</style>
