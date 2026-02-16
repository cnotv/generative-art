<script setup lang="ts">
import { Sheet } from "@/components/ui/sheet";
import { usePanels } from "@/composables/usePanels";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";

const { isSceneOpen, closePanel } = usePanels();
const viewConfig = useViewConfig();

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel("scene");
  }
};
</script>

<template>
  <Sheet :open="isSceneOpen" side="right" @update:open="handleOpenChange">
    <div class="scene-panel__content flex flex-col gap-6">
      <div v-if="viewConfig.hasSceneConfig.value" class="flex-1 min-h-0">
        <SchemaControls
          :schema="viewConfig.currentSceneSchema.value!"
          :get-value="viewConfig.getSceneConfigValue"
          :on-update="viewConfig.updateSceneConfig"
        />
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No scene configuration available for this view.
      </p>
    </div>
  </Sheet>
</template>

<style scoped>
.scene-panel__content {
  height: 100%;
}
</style>
