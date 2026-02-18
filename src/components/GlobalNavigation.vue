<script setup lang="ts">
import { computed } from 'vue';
import { Menu, Image, Settings, Layers, Bug, Video } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { useViewPanels } from '@/composables/useViewPanels';
import type { PanelType } from '@/composables/usePanels';

interface PanelButton {
  type: PanelType;
  icon: any;
  label: string;
}

const { activePanels, togglePanel } = usePanels();
const { viewPanels } = useViewPanels();

const allButtons = computed<PanelButton[]>(() => {
  const buttons: PanelButton[] = [
    { type: 'sidebar', icon: Menu, label: 'Navigation' },
  ];

  // Add view-specific panels if available
  if (viewPanels.value.showTextures) {
    buttons.push({ type: 'textures', icon: Image, label: 'Textures' });
  }

  if (viewPanels.value.showConfig) {
    buttons.push({ type: 'config', icon: Settings, label: 'Config' });
  }

  if (viewPanels.value.showScene) {
    buttons.push({ type: 'scene', icon: Layers, label: 'Scene' });
  }

  // Add global panels
  buttons.push(
    { type: 'debug', icon: Bug, label: 'Debug' },
    { type: 'camera', icon: Video, label: 'Camera' }
  );

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
    class="global-navigation"
    :class="{ 'global-navigation--visible': hasActivePanels }"
  >
    <Button
      v-for="button in allButtons"
      :key="button.type"
      variant="ghost"
      size="icon"
      class="global-navigation__button"
      :class="{ 'global-navigation__button--active': isPanelOpen(button.type) }"
      :aria-label="button.label"
      @click="handleToggle(button.type)"
    >
      <component :is="button.icon" class="h-5 w-5" />
    </Button>
  </nav>
</template>

<style scoped>
.global-navigation {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  backdrop-filter: blur(10px);
  border-radius: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--color-foreground);
}

.global-navigation:hover,
.global-navigation:focus-within,
.global-navigation--visible {
  opacity: 1;
}

.global-navigation__button {
  transition: all 0.2s;
}

.global-navigation__button--active {
  background-color: hsl(0 0% 83%);
}

.global-navigation__button:hover {
  background-color: hsl(0 0% 90%);
}

@media (prefers-color-scheme: dark) {
  .global-navigation__button--active {
    background-color: hsl(0 0% 25%);
  }

  .global-navigation__button:hover {
    background-color: hsl(0 0% 20%);
  }
}
</style>
