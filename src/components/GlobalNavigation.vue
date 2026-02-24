<script setup lang="ts">
import { computed } from 'vue';
import { Menu, Image, Settings, Layers, Bug, Video, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { useViewPanels } from '@/composables/useViewPanels';
import type { PanelType } from '@/composables/usePanels';

interface PanelButton {
  type: PanelType;
  icon: any;
  label: string;
}

const { activePanels, togglePanel, closeAllPanels } = usePanels();
const { viewPanels } = useViewPanels();

const hasOpenPanels = computed(() => activePanels.value.size > 0);

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
    :class="{ 'global-navigation--visible': hasOpenPanels }"
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

    <Button
      v-if="hasOpenPanels"
      variant="ghost"
      size="icon"
      class="global-navigation__button global-navigation__close-all"
      aria-label="Close all panels"
      @click="closeAllPanels"
    >
      <X class="h-5 w-5" />
    </Button>
  </nav>
</template>

<style scoped>
.global-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: var(--nav-height);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 0.5rem;
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(10px);
  color: var(--color-foreground);
  opacity: 0;
  transition: opacity 0.2s;
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

.global-navigation__close-all {
  position: absolute;
  right: 0.5rem;
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
