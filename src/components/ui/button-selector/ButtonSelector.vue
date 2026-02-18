<script setup lang="ts">
import Button from "@/components/ui/button/Button.vue";

export interface ButtonOption {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: string;
  options: (string | ButtonOption)[];
  direction?: "row" | "column";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const getValue = (opt: string | ButtonOption): string =>
  typeof opt === "string" ? opt : opt.value;

const getLabel = (opt: string | ButtonOption): string =>
  typeof opt === "string" ? opt : opt.label;

const getColor = (opt: string | ButtonOption): string | undefined =>
  typeof opt === "string" ? undefined : opt.color;

const getDisabled = (opt: string | ButtonOption): boolean =>
  typeof opt === "string" ? false : (opt.disabled ?? false);
</script>

<template>
  <div
    class="button-selector"
    :class="{ 'button-selector--column': direction === 'column' }"
  >
    <Button
      v-for="opt in options"
      :key="getValue(opt)"
      size="sm"
      :variant="modelValue === getValue(opt) ? 'default' : 'outline'"
      :disabled="getDisabled(opt)"
      class="button-selector__btn"
      @click="emit('update:modelValue', getValue(opt))"
    >
      <span
        v-if="getColor(opt)"
        class="button-selector__swatch"
        :style="{ background: getColor(opt) }"
      ></span>
      {{ getLabel(opt) }}
    </Button>
  </div>
</template>

<style scoped>
.button-selector {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.button-selector--column {
  flex-direction: column;
  flex-wrap: nowrap;
}

.button-selector__btn {
  justify-content: flex-start;
  gap: 0.375rem;
}

.button-selector__swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  flex-shrink: 0;
}
</style>
