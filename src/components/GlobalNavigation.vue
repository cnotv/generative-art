<script setup lang="ts">
import { computed } from 'vue';
import { Menu, Settings, Bug, Box, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { usePanelsStore } from '@/stores/panels';
import type { PanelType } from '@/stores/panels';

interface PanelButton {
  type: PanelType;
  icon: any;
  label: string;
}

const panelsStore = usePanelsStore();

const hasOpenPanels = computed(() => panelsStore.activePanels.size > 0);

const navigationButton = computed<PanelButton>(() => ({
  type: 'navigation',
  icon: Menu,
  label: 'Navigation',
}));

const panelButtons = computed<PanelButton[]>(() => [
  { type: 'config', icon: Settings, label: 'Config' },
  { type: 'elements', icon: Box, label: 'Elements' },
  { type: 'debug', icon: Bug, label: 'Debug' },
]);

const isPanelOpen = (panelType: PanelType) => panelsStore.activePanels.has(panelType);

const handleToggle = (panelType: PanelType) => {
  panelsStore.togglePanel(panelType);
};
</script>

<template>
  <nav
    class="global-navigation"
    :class="{ 'global-navigation--visible': hasOpenPanels }"
  >
    <div class="global-navigation__left">
      <Button
        variant="ghost"
        size="icon"
        class="global-navigation__button"
        :class="{ 'global-navigation__button--active': isPanelOpen(navigationButton.type) }"
        :aria-label="navigationButton.label"
        @click="handleToggle(navigationButton.type)"
      >
        <component :is="navigationButton.icon" class="h-5 w-5" />
      </Button>
    </div>

    <div class="global-navigation__center">
      <Button
        v-for="button in panelButtons"
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
    </div>

    <div class="global-navigation__right">
      <Button
        v-if="hasOpenPanels"
        variant="ghost"
        size="icon"
        class="global-navigation__button"
        aria-label="Close all panels"
        @click="panelsStore.closeAllPanels"
      >
        <X class="h-5 w-5" />
      </Button>
    </div>
  </nav>
</template>

<style scoped>
.global-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  z-index: 50;
  display: flex;
  align-items: center;
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

.global-navigation__left {
  flex-shrink: 0;
  width: 2.5rem;
}

.global-navigation__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.global-navigation__right {
  flex-shrink: 0;
  width: 2.5rem;
  display: flex;
  justify-content: flex-end;
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
