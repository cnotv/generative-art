<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const dropdownOpen = ref(false)
const dropdownStyle = ref<{ bottom: string; left: string }>({ bottom: '0px', left: '0px' })
const rootReference = ref<HTMLElement | null>(null)
const dropdownReference = ref<HTMLElement | null>(null)

const toggle = (): void => {
  if (!dropdownOpen.value && rootReference.value) {
    const rect = rootReference.value.getBoundingClientRect()
    dropdownStyle.value = {
      bottom: `${window.innerHeight - rect.top}px`,
      left: `${rect.left}px`
    }
  }
  dropdownOpen.value = !dropdownOpen.value
}

const onInputChange = (event: Event): void => {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number.parseInt(raw, 10)
  const min = props.min ?? 1
  const max = props.max ?? 80
  if (!Number.isNaN(parsed)) {
    emit('update:modelValue', Math.min(max, Math.max(min, parsed)))
  }
}

const onClickOutside = (event: MouseEvent): void => {
  const target = event.target as Node
  const insideRoot = rootReference.value?.contains(target) ?? false
  const insideDropdown = dropdownReference.value?.contains(target) ?? false
  if (!insideRoot && !insideDropdown) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootReference" class="brush-size">
    <Button
      variant="outline"
      size="sm"
      title="Brush size"
      class="brush-size__trigger"
      @click="toggle"
    >
      <span class="brush-size__value">{{ modelValue }}</span>
      <span class="brush-size__unit">px</span>
    </Button>

    <Teleport to="body">
      <div
        v-if="dropdownOpen"
        ref="dropdownReference"
        class="brush-size__dropdown"
        :style="dropdownStyle"
      >
        <div class="brush-size__label">
          <span>Size</span>
          <input
            type="number"
            :value="modelValue"
            :min="min ?? 1"
            :max="max ?? 80"
            step="1"
            class="brush-size__input"
            @input="onInputChange"
          />
        </div>
        <Slider
          :model-value="[modelValue]"
          :min="min ?? 1"
          :max="max ?? 80"
          :step="1"
          class="brush-size__slider"
          @update:model-value="emit('update:modelValue', $event[0])"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.brush-size {
  position: relative;
}

.brush-size__trigger {
  min-width: 3.5rem;
  justify-content: center;
  gap: var(--spacing-1);
}

.brush-size__value {
  display: inline-block;
  min-width: 2ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.brush-size__unit {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-xs);
}

.brush-size__dropdown {
  position: fixed;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  min-width: 12rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.brush-size__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-muted-foreground);
}

.brush-size__input {
  background: transparent;
  border: none;
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-xs);
  text-align: right;
  width: 3.5em;
  padding: 0 var(--spacing-1);
  outline: none;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s;
}

.brush-size__input:hover {
  background-color: var(--color-secondary);
}

.brush-size__input:focus {
  background-color: var(--color-secondary);
  box-shadow: 0 0 0 1px var(--color-ring);
}

.brush-size__input::-webkit-outer-spin-button,
.brush-size__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.brush-size__input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.brush-size__slider {
  width: 100%;
}
</style>
