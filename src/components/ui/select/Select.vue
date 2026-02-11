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
