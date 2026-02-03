<script setup lang="ts">
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { useViewConfig } from '@/composables/useViewConfig';
import ConfigControls from './ConfigControls.vue';
import { Settings } from 'lucide-vue-next';
import type { ConfigControlsSchema } from '@/composables/useViewConfig';

const props = withDefaults(
  defineProps<{
    title?: string;
    schema?: ConfigControlsSchema | null;
    getValue?: (path: string) => any;
    onUpdate?: (path: string, value: any) => void;
  }>(),
  {
    title: 'Configuration',
  }
);

const { isConfigOpen, togglePanel, closePanel } = usePanels();
const viewConfig = useViewConfig();

// Use props if provided, otherwise fall back to useViewConfig
const activeSchema = () => props.schema ?? viewConfig.currentSchema.value;
const activeGetValue = (path: string) => props.getValue?.(path) ?? viewConfig.getConfigValue(path);
const activeOnUpdate = (path: string, value: any) => {
  if (props.onUpdate) {
    props.onUpdate(path, value);
  } else {
    viewConfig.updateConfig(path, value);
  }
};

const hasActiveConfig = () => activeSchema() !== null;

const handleToggle = () => {
  togglePanel('config');
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};
</script>

<template>
  <div class="config-panel">
    <Button
      variant="ghost"
      size="icon"
      class="config-panel__trigger fixed right-4 top-4 z-40 opacity-0 hover:opacity-100 hover:bg-black/70 transition-opacity"
      @click="handleToggle"
    >
      <Settings class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isConfigOpen" side="right" @update:open="handleOpenChange">
      <div class="config-panel__content flex flex-col gap-6">
        <h2 class="text-lg font-semibold shrink-0">{{ title }}</h2>

        <div class="config-panel__options flex-1 overflow-y-auto min-h-0">
          <ConfigControls
            v-if="hasActiveConfig() && activeSchema()"
            :schema="activeSchema()!"
            :get-value="activeGetValue"
            :on-update="activeOnUpdate"
          />
          <p v-else class="text-sm text-muted-foreground">
            No configuration available for this view.
          </p>
        </div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.config-panel__content {
  height: 100%;
}
</style>
