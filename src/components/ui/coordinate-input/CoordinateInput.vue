<script setup lang="ts">
import { computed } from "vue";
import type { CoordinateTuple } from "@webgamekit/threejs";
import Slider from "../slider/Slider.vue";

interface Props {
  modelValue: CoordinateTuple | { x: number; y: number; z: number };
  label?: string;
  min?: number | { x: number; y: number; z: number };
  max?: number | { x: number; y: number; z: number };
  step?: number | { x: number; y: number; z: number };
}

const props = withDefaults(defineProps<Props>(), {
  label: "Coordinates",
  min: 0,
  max: 100,
  step: 1,
});

const emit = defineEmits<{
  (
    e: "update:modelValue",
    value: CoordinateTuple | { x: number; y: number; z: number }
  ): void;
}>();

// Determine if we're working with array or object format
const isArray = computed(() => Array.isArray(props.modelValue));

// Normalize values to always work with x, y, z
const values = computed(() => {
  if (isArray.value) {
    const arr = props.modelValue as CoordinateTuple;
    return { x: arr[0], y: arr[1], z: arr[2] };
  }
  return props.modelValue as { x: number; y: number; z: number };
});

// Helper to get min/max/step for a coordinate
const getCoordValue = (coord: "x" | "y" | "z", type: "min" | "max" | "step") => {
  const value = props[type];
  if (typeof value === "number") return value;
  return value[coord];
};

// Update handlers
const updateX = (value: number) => {
  if (isArray.value) {
    emit("update:modelValue", [value, values.value.y, values.value.z] as CoordinateTuple);
  } else {
    emit("update:modelValue", { ...values.value, x: value });
  }
};

const updateY = (value: number) => {
  if (isArray.value) {
    emit("update:modelValue", [values.value.x, value, values.value.z] as CoordinateTuple);
  } else {
    emit("update:modelValue", { ...values.value, y: value });
  }
};

const updateZ = (value: number) => {
  if (isArray.value) {
    emit("update:modelValue", [values.value.x, values.value.y, value] as CoordinateTuple);
  } else {
    emit("update:modelValue", { ...values.value, z: value });
  }
};

// Direct input handlers
const handleInputX = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!isNaN(value)) {
    updateX(value);
  }
};

const handleInputY = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!isNaN(value)) {
    updateY(value);
  }
};

const handleInputZ = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!isNaN(value)) {
    updateZ(value);
  }
};
</script>

<template>
  <div class="coordinate-input">
    <label class="coordinate-input__label">{{ label }}</label>

    <div class="coordinate-input__sliders">
      <div class="coordinate-input__slider-group">
        <label class="coordinate-input__value">
          X:
          <input
            type="number"
            :value="values.x.toFixed(2)"
            :min="getCoordValue('x', 'min')"
            :max="getCoordValue('x', 'max')"
            :step="getCoordValue('x', 'step')"
            @input="handleInputX"
            class="coordinate-input__input"
          />
        </label>
        <Slider
          :model-value="[values.x]"
          :min="getCoordValue('x', 'min')"
          :max="getCoordValue('x', 'max')"
          :step="getCoordValue('x', 'step')"
          @update:model-value="updateX($event[0])"
          class="coordinate-input__slider"
        />
      </div>

      <div class="coordinate-input__slider-group">
        <label class="coordinate-input__value">
          Y:
          <input
            type="number"
            :value="values.y.toFixed(2)"
            :min="getCoordValue('y', 'min')"
            :max="getCoordValue('y', 'max')"
            :step="getCoordValue('y', 'step')"
            @input="handleInputY"
            class="coordinate-input__input"
          />
        </label>
        <Slider
          :model-value="[values.y]"
          :min="getCoordValue('y', 'min')"
          :max="getCoordValue('y', 'max')"
          :step="getCoordValue('y', 'step')"
          @update:model-value="updateY($event[0])"
          class="coordinate-input__slider"
        />
      </div>

      <div class="coordinate-input__slider-group">
        <label class="coordinate-input__value">
          Z:
          <input
            type="number"
            :value="values.z.toFixed(2)"
            :min="getCoordValue('z', 'min')"
            :max="getCoordValue('z', 'max')"
            :step="getCoordValue('z', 'step')"
            @input="handleInputZ"
            class="coordinate-input__input"
          />
        </label>
        <Slider
          :model-value="[values.z]"
          :min="getCoordValue('z', 'min')"
          :max="getCoordValue('z', 'max')"
          :step="getCoordValue('z', 'step')"
          @update:model-value="updateZ($event[0])"
          class="coordinate-input__slider"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.coordinate-input {
  margin-bottom: 16px;
}

.coordinate-input__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.75rem;
  font-weight: 500;
}

.coordinate-input__value {
  display: block;
  text-align: center;
  margin-bottom: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.coordinate-input__input {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-align: center;
  width: 4em;
  padding: 2px 4px;
  outline: none;
  border-radius: 2px;
  transition: background-color 0.15s;
  font-size: inherit;
  font-weight: inherit;
}

.coordinate-input__input:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.coordinate-input__input:focus {
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

/* Hide spinner buttons in number input */
.coordinate-input__input::-webkit-outer-spin-button,
.coordinate-input__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.coordinate-input__input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.coordinate-input__sliders {
  display: flex;
  gap: 12px;
  align-items: center;
}

.coordinate-input__slider-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.coordinate-input__slider {
  width: 100%;
  margin-top: 4px;
}
</style>
