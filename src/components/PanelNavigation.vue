<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Image, Settings } from 'lucide-vue-next';
import { usePanels } from '@/composables/usePanels';
import type { PanelType } from '@/composables/usePanels';

interface PanelButton {
  type: PanelType;
  icon: any;
  label: string;
}

interface Props {
  showTextures?: boolean;
  showConfig?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTextures: false,
  showConfig: false,
});

const { activePanels, togglePanel } = usePanels();

const panelButtons = computed<PanelButton[]>(() => {
  const buttons: PanelButton[] = [];

  if (props.showTextures) {
    buttons.push({ type: 'textures', icon: Image, label: 'Textures' });
  }

  if (props.showConfig) {
    buttons.push({ type: 'config', icon: Settings, label: 'Config' });
  }

  return buttons;
});

const hasActivePanels = computed(() => activePanels.value.size > 0);

const isPanelOpen = (panelType: PanelType) => {
  return activePanels.value.has(panelType);
};

const handleToggle = (panelType: PanelType) => {
  togglePanel(panelType);
};
</script>

<template>
  <nav
    v-if="panelButtons.length > 0"
    class="panel-navigation"
    :class="{ 'panel-navigation--visible': hasActivePanels }"
  >
    <Button
      v-for="button in panelButtons"
      :key="button.type"
      variant="ghost"
      size="icon"
      class="panel-navigation__button"
      :class="{ 'panel-navigation__button--active': isPanelOpen(button.type) }"
      :aria-label="button.label"
      @click="handleToggle(button.type)"
    >
      <component :is="button.icon" class="h-5 w-5 text-white" />
    </Button>
  </nav>
</template>

<style scoped>
.panel-navigation {
  position: fixed;
  left: 1rem;
  top: 1rem;
  z-index: 40;
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.panel-navigation:hover,
.panel-navigation:focus-within,
.panel-navigation--visible {
  opacity: 1;
}

.panel-navigation__button {
  transition: all 0.2s ease-in-out;
}

.panel-navigation__button:hover {
  background-color: rgba(0, 0, 0, 0.7);
}

.panel-navigation__button--active {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.7);
}
</style>
