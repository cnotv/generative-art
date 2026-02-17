<script setup lang="ts">
import { Sheet } from "@/components/ui/sheet";
import { usePanels } from "@/composables/usePanels";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";

const { isConfigOpen, closePanel } = usePanels();
const viewConfig = useViewConfig();

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel("config");
  }
};
</script>

<template>
  <Sheet :open="isConfigOpen" side="right" @update:open="handleOpenChange">
    <div class="config-panel__content flex flex-col gap-6">
      <div v-if="viewConfig.hasConfig.value" class="flex-1 min-h-0">
        <SchemaControls
          :schema="viewConfig.currentSchema.value!"
          :get-value="viewConfig.getConfigValue"
          :on-update="viewConfig.updateConfig"
        />
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No configuration available for this view.
      </p>
      <div id="config-panel-extra"></div>
    </div>
  </Sheet>
</template>

<style scoped>
.config-panel__content {
  height: 100%;
}
</style>
