import { ref, computed } from 'vue';

export type PanelType = 'sidebar' | 'controls' | 'debug' | null;

const activePanel = ref<PanelType>(null);

export const usePanels = () => {
  const isSidebarOpen = computed(() => activePanel.value === 'sidebar');
  const isControlsOpen = computed(() => activePanel.value === 'controls');
  const isDebugOpen = computed(() => activePanel.value === 'debug');

  const openPanel = (panel: PanelType) => {
    activePanel.value = panel;
  };

  const closePanel = () => {
    activePanel.value = null;
  };

  const togglePanel = (panel: Exclude<PanelType, null>) => {
    activePanel.value = activePanel.value === panel ? null : panel;
  };

  return {
    activePanel: computed(() => activePanel.value),
    isSidebarOpen,
    isControlsOpen,
    isDebugOpen,
    openPanel,
    closePanel,
    togglePanel,
  };
};
