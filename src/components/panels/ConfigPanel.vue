<script setup lang="ts">
import GenericPanel from "./GenericPanel.vue";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";

const viewConfig = useViewConfig();
</script>

<template>
  <GenericPanel panel-type="config" side="right">
    <div class="config-panel__content flex flex-col gap-6">
      <div v-if="viewConfig.hasConfig.value" class="flex-1 min-h-0">
        <SchemaControls
          :schema="viewConfig.currentSchema.value!"
          :get-value="viewConfig.getConfigValue"
          :on-update="viewConfig.updateConfig"
          :on-action="viewConfig.invokeCallback"
        />
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No configuration available for this view.
      </p>
      <div id="config-panel-extra"></div>
    </div>
  </GenericPanel>
</template>

<style scoped>
.config-panel__content {
  height: 100%;
}
</style>
