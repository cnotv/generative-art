<script setup lang="ts">
import GenericPanel from "./GenericPanel.vue";
import { useViewConfig } from "@/composables/useViewConfig";
import SchemaControls from "./ConfigControls.vue";

const viewConfig = useViewConfig();
</script>

<template>
  <GenericPanel panel-type="config" side="right">
    <SchemaControls
      v-if="viewConfig.hasConfig.value"
      :schema="viewConfig.currentSchema.value!"
      :get-value="viewConfig.getConfigValue"
      :on-update="viewConfig.updateConfig"
      :on-action="viewConfig.invokeCallback"
    />
    <p v-else class="text-sm text-muted-foreground">
      No configuration available for this view.
    </p>
    <div id="config-panel-extra"></div>
  </GenericPanel>
</template>
