<script setup lang="ts">
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { Settings } from 'lucide-vue-next';

const { isControlsOpen, togglePanel, closePanel } = usePanels();

const handleToggle = () => {
  togglePanel('controls');
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};
</script>

<template>
  <div class="controls-panel">
    <Button
      variant="ghost"
      size="icon"
      class="controls-panel__trigger fixed right-4 top-4 z-40 opacity-0 hover:opacity-100 hover:bg-black/70 transition-opacity"
      @click="handleToggle"
    >
      <Settings class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isControlsOpen" side="right" @update:open="handleOpenChange">
      <div class="controls-panel__content flex flex-col gap-6">
        <h2 class="text-lg font-semibold">Controls</h2>

        <div class="controls-panel__options">
          <slot />
        </div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.controls-panel__content {
  height: 100%;
}
</style>
