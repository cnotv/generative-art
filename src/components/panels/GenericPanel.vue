<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight, X } from 'lucide-vue-next'
import { Sheet } from '@/components/ui/sheet'
import { usePanelsStore } from '@/stores/panels'
import type { PanelType } from '@/stores/panels'

interface Properties {
  panelType: PanelType
  side?: 'left' | 'right' | 'top' | 'bottom'
  title?: string
}

const props = withDefaults(defineProps<Properties>(), {
  side: 'right',
  title: undefined
})

const panelsStore = usePanelsStore()
const collapsed = ref(false)

const isOpen = computed(() => panelsStore.activePanels.has(props.panelType))

const handleOpenChange = (open: boolean) => {
  if (!open) {
    panelsStore.closePanel(props.panelType)
  }
}

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const closePanel = () => {
  panelsStore.closePanel(props.panelType)
}
</script>

<template>
  <Sheet :open="isOpen" :side="side" @update:open="handleOpenChange">
    <div class="generic-panel" :class="{ 'generic-panel--collapsed': collapsed }">
      <div
        v-if="title"
        class="generic-panel__header"
        role="button"
        tabindex="0"
        @click="toggleCollapse"
        @keydown.enter.space.prevent="toggleCollapse"
      >
        <component :is="collapsed ? ChevronRight : ChevronDown" class="generic-panel__chevron" />
        <span class="generic-panel__title">{{ title }}</span>
        <button
          class="generic-panel__close"
          aria-label="Close panel"
          @click.stop="closePanel"
          @keydown.enter.space.prevent.stop="closePanel"
        >
          <X class="generic-panel__close-icon" />
        </button>
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

.generic-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: var(--spacing-0-5);
  cursor: pointer;
  color: var(--color-muted-foreground);
  border-radius: var(--radius-sm);
  transition: color 150ms;
}

.generic-panel__close:hover {
  color: var(--color-foreground);
}

.generic-panel__close-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
}

.generic-panel__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}
</style>
