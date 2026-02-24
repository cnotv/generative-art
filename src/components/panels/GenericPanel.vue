<script setup lang="ts">
import { computed } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { usePanels } from '@/composables/usePanels';
import type { PanelType } from '@/composables/usePanels';

interface Props {
  panelType: PanelType;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
});

const { activePanels, closePanel } = usePanels();

const isOpen = computed(() => activePanels.value.has(props.panelType));

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel(props.panelType);
  }
};
</script>

<template>
  <Sheet :open="isOpen" :side="side" @update:open="handleOpenChange">
    <slot />
  </Sheet>
</template>
