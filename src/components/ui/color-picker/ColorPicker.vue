<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'radix-vue';
import { cn } from '@/lib/utilities';

const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const internalValue = ref(props.modelValue ?? '#000000');

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== undefined) {
      internalValue.value = newValue;
    }
  }
);

const handleColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  internalValue.value = target.value;
  emit('update:modelValue', target.value);
};

const presetColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff',
];

const selectPreset = (color: string) => {
  internalValue.value = color;
  emit('update:modelValue', color);
};
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      :disabled="disabled"
      :class="
        cn(
          'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          $props.class
        )
      "
    >
      <div
        class="h-5 w-5 rounded border"
        :style="{ backgroundColor: internalValue }"
      />
      <span class="font-mono text-xs">{{ internalValue }}</span>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="z-50 w-64 rounded-md border bg-background p-4 shadow-md"
        :side-offset="4"
      >
        <div class="flex flex-col gap-4">
          <input
            type="color"
            :value="internalValue"
            class="h-32 w-full cursor-pointer rounded border-0"
            @input="handleColorChange"
          />

          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="color in presetColors"
              :key="color"
              type="button"
              class="h-6 w-6 rounded border hover:scale-110 transition-transform"
              :style="{ backgroundColor: color }"
              @click="selectPreset(color)"
            />
          </div>

          <div class="flex items-center gap-2">
            <label class="text-xs text-muted-foreground">Hex:</label>
            <input
              :value="internalValue"
              type="text"
              class="flex-1 rounded border bg-background px-2 py-1 text-xs font-mono"
              @input="handleColorChange"
            />
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
