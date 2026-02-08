<script setup lang="ts">
import { computed } from 'vue';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { ConfigControlsSchema, ControlSchema } from '@/composables/useViewConfig';

const props = defineProps<{
  schema: ConfigControlsSchema;
  getValue: (path: string) => any;
  onUpdate: (path: string, value: any) => void;
  basePath?: string;
}>();

const isControlSchema = (obj: any): obj is ControlSchema => {
  if (typeof obj !== 'object' || obj === null) return false;
  const keys = Object.keys(obj);
  const controlKeys = ['min', 'max', 'step', 'boolean', 'color', 'label'];
  return keys.length === 0 || keys.some(k => controlKeys.includes(k));
};

const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
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
const defaultOpenGroups = computed(() => groups.value.groups.map(g => g.key));

const handleSliderUpdate = (path: string, value: number[]) => {
  props.onUpdate(path, value[0]);
};

const handleInputUpdate = (path: string, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (!isNaN(numValue)) {
    props.onUpdate(path, numValue);
  }
};

const handleCheckboxUpdate = (path: string, value: boolean) => {
  props.onUpdate(path, value);
};
</script>

<template>
  <div class="config-controls flex flex-col gap-2">
    <!-- Direct controls at this level -->
    <div v-for="control in groups.controls" :key="control.path" class="config-controls__item flex flex-col gap-1">
      <template v-if="control.schema.boolean !== undefined">
        <div class="flex items-center gap-2">
          <Checkbox
            :id="control.path"
            :model-value="getValue(control.path) ?? control.schema.boolean"
            @update:model-value="handleCheckboxUpdate(control.path, $event)"
          />
          <label :for="control.path" class="text-xs cursor-pointer">
            {{ control.schema.label ?? formatLabel(control.key) }}
          </label>
        </div>
      </template>

      <template v-else-if="control.schema.min !== undefined || control.schema.max !== undefined">
        <label :for="control.path" class="text-xs font-medium">
          {{ control.schema.label ?? formatLabel(control.key) }}:
          <span class="text-muted-foreground">{{ getValue(control.path) ?? 0 }}</span>
        </label>
        <Slider
          :id="control.path"
          :model-value="[getValue(control.path) ?? control.schema.min ?? 0]"
          :min="control.schema.min ?? 0"
          :max="control.schema.max ?? 100"
          :step="control.schema.step ?? 1"
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
          :step="control.schema.step"
          class="h-7 text-xs"
          @update:model-value="handleInputUpdate(control.path, $event)"
        />
      </template>
    </div>

    <!-- Nested groups (open by default) -->
    <Accordion v-if="groups.groups.length > 0" type="multiple" :default-value="defaultOpenGroups" class="w-full">
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
</style>
