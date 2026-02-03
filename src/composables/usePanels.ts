import { ref, computed } from 'vue';

export type PanelType = 'sidebar' | 'config' | 'debug' | null;

const activePanel = ref<PanelType>(null);

export const usePanels = () => {
  const isSidebarOpen = computed(() => activePanel.value === 'sidebar');
  const isConfigOpen = computed(() => activePanel.value === 'config');
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
    isConfigOpen,
    isDebugOpen,
    openPanel,
    closePanel,
    togglePanel,
  };
};
