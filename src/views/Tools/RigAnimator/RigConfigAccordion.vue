<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import ConfigControls from '@/components/panels/ConfigControls.vue'
import type { RigPanelGroup } from './types'

defineProps<{
  groups: RigPanelGroup[]
  getValue: (path: string) => unknown
  onUpdate: (path: string, value: unknown) => void
  onAction: (name: string) => void
}>()
</script>

<template>
  <!-- Every section starts collapsed: the panel opens onto the camera preview and its actions,
       and a setting is one click away rather than a scroll past all of them. -->
  <Accordion type="multiple" :default-value="[]" class="rig-config-accordion">
    <AccordionItem v-for="group in groups" :key="group.key" :value="group.key">
      <AccordionTrigger class="text-xs font-medium py-1">{{ group.label }}</AccordionTrigger>
      <AccordionContent>
        <ConfigControls
          :schema="group.schema"
          :get-value="getValue"
          :on-update="onUpdate"
          :on-action="onAction"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

<style scoped>
.rig-config-accordion {
  width: 100%;
}
</style>
