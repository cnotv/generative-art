<script setup lang="ts">
import { computed } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { usePanelsStore } from '@/stores/panels';
import type { PanelType } from '@/stores/panels';

interface Props {
  panelType: PanelType;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
});

const panelsStore = usePanelsStore();

const isOpen = computed(() => panelsStore.activePanels.has(props.panelType));

const handleOpenChange = (open: boolean) => {
  if (!open) {
    panelsStore.closePanel(props.panelType);
  }
};
</script>

<template>
  <Sheet :open="isOpen" :side="side" @update:open="handleOpenChange">
    <slot />
  </Sheet>
</template>
