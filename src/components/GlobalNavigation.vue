<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Menu, Settings, Bug, Box, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePanelsStore } from '@/stores/panels'
import type { PanelType } from '@/stores/panels'

const NAV_HEIGHT_PX = 48 // matches --nav-height: 3rem

interface PanelButton {
  type: PanelType
  icon: any
  label: string
}

const panelsStore = usePanelsStore()
const isNearTop = ref(false)
const hasOpenPanels = computed(() => panelsStore.activePanels.size > 0)

const onMouseMove = (e: MouseEvent) => {
  isNearTop.value = e.clientY <= NAV_HEIGHT_PX
}

onMounted(() => window.addEventListener('mousemove', onMouseMove))
onUnmounted(() => window.removeEventListener('mousemove', onMouseMove))

const navigationButton = computed<PanelButton>(() => ({
  type: 'navigation',
  icon: Menu,
  label: 'Navigation'
}))

const panelButtons = computed<PanelButton[]>(() => [
  { type: 'elements', icon: Box, label: 'Elements' },
  { type: 'config', icon: Settings, label: 'Config' },
  { type: 'debug', icon: Bug, label: 'Debug' }
])

const isPanelOpen = (panelType: PanelType) => panelsStore.activePanels.has(panelType)

const handleToggle = (panelType: PanelType) => {
  panelsStore.togglePanel(panelType)
}
</script>

<template>
  <nav
    class="global-navigation"
    :class="{ 'global-navigation--visible': isNearTop || hasOpenPanels }"
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
  z-index: var(--z-nav);
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(10px);
  color: var(--color-foreground);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.global-navigation--visible {
  opacity: 1;
  pointer-events: auto;
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
  transition: background-color 0.2s;
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
