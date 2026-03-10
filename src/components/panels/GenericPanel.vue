<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { Sheet } from '@/components/ui/sheet';
import { usePanelsStore } from '@/stores/panels';
import type { PanelType } from '@/stores/panels';

const PANEL_TITLES: Record<PanelType, string> = {
  navigation: 'Navigation',
  config: 'Config',
  scene: 'Scene',
  debug: 'Debug',
  elements: 'Elements',
};

interface Props {
  panelType: PanelType;
  side?: 'left' | 'right' | 'top' | 'bottom';
  title?: string;
  collapsible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
  title: undefined,
  collapsible: true,
});

const panelsStore = usePanelsStore();
const collapsed = ref(false);

const isOpen = computed(() => panelsStore.activePanels.has(props.panelType));
const panelTitle = computed(() => props.title ?? PANEL_TITLES[props.panelType]);

const handleOpenChange = (open: boolean) => {
  if (!open) {
    panelsStore.closePanel(props.panelType);
  }
};

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
};
</script>

<template>
  <Sheet :open="isOpen" :side="side" @update:open="handleOpenChange">
    <div class="generic-panel" :class="{ 'generic-panel--collapsed': collapsed }">
      <div
        v-if="collapsible"
        class="generic-panel__header"
        role="button"
        tabindex="0"
        @click="toggleCollapse"
        @keydown.enter.space.prevent="toggleCollapse"
      >
        <component :is="collapsed ? ChevronRight : ChevronDown" class="generic-panel__chevron" />
        <span class="generic-panel__title">{{ panelTitle }}</span>
      </div>
      <div v-show="!collapsed" class="generic-panel__content">
        <slot />
      </div>
    </div>
  </Sheet>
</template>

<style scoped>
.generic-panel {
  display: flex;
  flex-direction: column;
}

.generic-panel__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) 0;
  cursor: pointer;
  user-select: none;
  margin-bottom: var(--spacing-1);
  color: var(--color-foreground);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.generic-panel__header:hover {
  color: var(--color-primary);
}

.generic-panel__chevron {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  flex-shrink: 0;
}

.generic-panel__title {
  flex: 1;
}

.generic-panel__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}
</style>
