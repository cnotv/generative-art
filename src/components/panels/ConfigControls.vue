<script setup lang="ts">
import { computed } from "vue";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CoordinateInput } from "@/components/ui/coordinate-input";
import ColorPicker from "@/components/ui/color-picker/ColorPicker.vue";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import type { ConfigControlsSchema, ControlSchema } from "@/composables/useViewConfig";

const props = defineProps<{
  schema: ConfigControlsSchema;
  getValue: (path: string) => any;
  onUpdate: (path: string, value: any) => void;
  basePath?: string;
}>();

const isControlSchema = (obj: any): obj is ControlSchema => {
  if (typeof obj !== "object" || obj === null) return false;
  const keys = Object.keys(obj);
  const controlKeys = ["min", "max", "step", "boolean", "color", "label", "options", "component"];

  // Empty object is a control schema (will be rendered as input)
  if (keys.length === 0) return true;

  // If ALL keys are control keys AND at least one is a control property (not nested config), it's a control schema
  // Check if values are primitive types (number, string, boolean) or arrays for options
  const allKeysAreControlKeys = keys.every((k) => controlKeys.includes(k));
  if (!allKeysAreControlKeys) return false;

  // If all keys are control keys, check if any value is an object (meaning it's nested config)
  // BUT allow min/max/step to be objects (for per-coordinate values in CoordinateInput)
  const hasNestedObjects = keys.some((k) => {
    if (k === 'min' || k === 'max' || k === 'step') return false; // Allow these to be objects
    const value = obj[k];
    return typeof value === "object" && value !== null && !Array.isArray(value);
  });

  // It's a control schema only if all keys are control keys AND there are no nested objects
  return !hasNestedObjects;
};

const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const getFullPath = (key: string): string => {
  return props.basePath ? `${props.basePath}.${key}` : key;
};

const groups = computed(() => {
  const result: { key: string; schema: ConfigControlsSchema }[] = [];
  const controls: { key: string; path: string; schema: ControlSchema }[] = [];

  Object.entries(props.schema).forEach(([key, value]) => {
    if (isControlSchema(value)) {
      controls.push({ key, path: getFullPath(key), schema: value });
    } else {
      result.push({ key, schema: value as ConfigControlsSchema });
    }
  });

  return { groups: result, controls };
});

// All group keys for default-open accordion
const defaultOpenGroups = computed(() => groups.value.groups.map((g) => g.key));

const handleSliderUpdate = (path: string, value: number[]) => {
  props.onUpdate(path, value[0]);
};

const handleInputUpdate = (path: string, value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (!isNaN(numValue)) {
    props.onUpdate(path, numValue);
  }
};

const handleCheckboxUpdate = (path: string, value: boolean) => {
  props.onUpdate(path, value);
};

const handleSelectUpdate = (path: string, value: string) => {
  props.onUpdate(path, value);
};

const handleColorUpdate = (path: string, hexValue: string) => {
  // Convert hex to integer (e.g., #98887d -> 0x98887d)
  const colorInt = parseInt(hexValue.replace('#', ''), 16);
  props.onUpdate(path, colorInt);
};

const getColorHex = (path: string): string => {
  const value = props.getValue(path);
  if (typeof value === 'number') {
    // Convert integer to hex string (e.g., 0x98887d -> #98887d)
    return '#' + value.toString(16).padStart(6, '0');
  }
  return value || '#000000';
};
</script>

<template>
  <div class="config-controls flex flex-col gap-2">
    <!-- Direct controls at this level -->
    <div
      v-for="control in groups.controls"
      :key="control.path"
      class="config-controls__item flex flex-col gap-1"
    >
      <template v-if="control.schema.component === 'CoordinateInput'">
        <CoordinateInput
          :model-value="getValue(control.path)"
          :label="control.schema.label ?? formatLabel(control.key)"
          :min="control.schema.min"
          :max="control.schema.max"
          :step="control.schema.step"
          @update:model-value="onUpdate(control.path, $event)"
        />
      </template>

      <template v-else-if="control.schema.options !== undefined">
        <label :for="control.path" class="text-xs font-medium">
          {{ control.schema.label ?? formatLabel(control.key) }}
        </label>
        <Select
          :model-value="String(getValue(control.path) || '')"
          :options="control.schema.options.map(opt => ({ value: opt, label: opt }))"
          @update:model-value="handleSelectUpdate(control.path, $event)"
          class="h-7 text-xs"
        />
      </template>

      <template v-else-if="control.schema.color !== undefined">
        <label :for="control.path" class="text-xs font-medium">
          {{ control.schema.label ?? formatLabel(control.key) }}
        </label>
        <ColorPicker
          :model-value="getColorHex(control.path)"
          @update:model-value="handleColorUpdate(control.path, $event)"
          class="h-7"
        />
      </template>

      <template v-else-if="control.schema.boolean !== undefined">
        <div class="flex items-center justify-between">
          <label :for="control.path" class="text-xs font-medium">
            {{ control.schema.label ?? formatLabel(control.key) }}
          </label>
          <Switch
            :id="control.path"
            :model-value="getValue(control.path) ?? control.schema.boolean"
            @update:model-value="handleCheckboxUpdate(control.path, $event)"
          />
        </div>
      </template>

      <template
        v-else-if="control.schema.min !== undefined || control.schema.max !== undefined"
      >
        <label :for="control.path" class="text-xs font-medium">
          {{ control.schema.label ?? formatLabel(control.key) }}:
          <input
            type="number"
            :value="getValue(control.path) ?? 0"
            :min="typeof control.schema.min === 'number' ? control.schema.min : 0"
            :max="typeof control.schema.max === 'number' ? control.schema.max : 100"
            :step="typeof control.schema.step === 'number' ? control.schema.step : 1"
            @input="handleInputUpdate(control.path, ($event.target as HTMLInputElement).value)"
            class="config-controls__inline-input"
          />
        </label>
        <Slider
          :id="control.path"
          :model-value="[getValue(control.path) ?? (typeof control.schema.min === 'number' ? control.schema.min : 0)]"
          :min="typeof control.schema.min === 'number' ? control.schema.min : 0"
          :max="typeof control.schema.max === 'number' ? control.schema.max : 100"
          :step="typeof control.schema.step === 'number' ? control.schema.step : 1"
          @update:model-value="handleSliderUpdate(control.path, $event)"
        />
      </template>

      <template v-else>
        <label :for="control.path" class="text-xs font-medium">
          {{ control.schema.label ?? formatLabel(control.key) }}
        </label>
        <Input
          :id="control.path"
          type="number"
          :model-value="getValue(control.path) ?? 0"
          :step="typeof control.schema.step === 'number' ? control.schema.step : undefined"
          class="h-7 text-xs"
          @update:model-value="handleInputUpdate(control.path, $event)"
        />
      </template>
    </div>

    <!-- Nested groups (open by default) -->
    <Accordion
      v-if="groups.groups.length > 0"
      type="multiple"
      :default-value="defaultOpenGroups"
      class="w-full"
    >
      <AccordionItem v-for="group in groups.groups" :key="group.key" :value="group.key">
        <AccordionTrigger class="text-xs font-medium py-1">
          {{ formatLabel(group.key) }}
        </AccordionTrigger>
        <AccordionContent>
          <ConfigControls
            :schema="group.schema"
            :get-value="getValue"
            :on-update="onUpdate"
            :base-path="getFullPath(group.key)"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>

<style scoped>
.config-controls {
  overflow-x: hidden;
  padding-bottom: 1rem;
}

.config-controls__inline-input {
  background: transparent;
  border: none;
  color: hsl(var(--muted-foreground));
  font: inherit;
  text-align: left;
  width: 3.5em;
  padding: 0 4px;
  outline: none;
  border-radius: 2px;
  transition: background-color 0.15s;
  font-size: inherit;
  font-weight: inherit;
}

.config-controls__inline-input:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.config-controls__inline-input:focus {
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

/* Hide spinner buttons in number input */
.config-controls__inline-input::-webkit-outer-spin-button,
.config-controls__inline-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.config-controls__inline-input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
</style>
