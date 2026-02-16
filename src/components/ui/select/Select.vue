<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'radix-vue';
import { cn } from '@/lib/utilities';
import { Check, ChevronDown } from 'lucide-vue-next';

type SelectOption = {
  value: string;
  label: string;
};

defineProps<{
  modelValue?: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SelectTrigger :class="cn('select__trigger', $props.class)">
      <SelectValue :placeholder="placeholder ?? 'Select...'" />
      <ChevronDown class="h-4 w-4 opacity-50" />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="select__content"
        position="popper"
        :side-offset="4"
      >
        <SelectViewport class="select__viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="select__item"
          >
            <span class="select__item-indicator">
              <SelectItemIndicator>
                <Check class="h-4 w-4" />
              </SelectItemIndicator>
            </span>
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
.select__trigger {
  display: flex;
  height: 2.5rem;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-input);
  background-color: var(--color-background);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 150ms;
}

.select__trigger:hover {
  background-color: var(--color-accent);
}

.select__trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.select__trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.select__trigger[data-placeholder] {
  color: var(--color-muted-foreground);
}

.select__content {
  position: relative;
  z-index: 100;
  min-width: 8rem;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
}

.select__content[data-state="open"] {
  animation: fadeIn 150ms ease-out;
}

.select__content[data-state="closed"] {
  animation: fadeOut 150ms ease-in;
}

.select__viewport {
  padding: 0.25rem;
}

.select__item {
  position: relative;
  display: flex;
  width: 100%;
  cursor: pointer;
  user-select: none;
  align-items: center;
  border-radius: var(--radius-sm);
  padding: 0.375rem 0.5rem 0.375rem 2rem;
  font-size: 0.875rem;
  outline: none;
  transition: all 150ms;
}

.select__item:hover,
.select__item:focus {
  background-color: var(--color-accent);
  color: var(--color-accent-foreground);
}

.select__item[data-disabled] {
  pointer-events: none;
  opacity: 0.5;
}

.select__item[data-state="checked"] {
  font-weight: 500;
}

.select__item-indicator {
  position: absolute;
  left: 0.5rem;
  display: flex;
  height: 0.875rem;
  width: 0.875rem;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>
