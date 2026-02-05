import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type PanelType = 'sidebar' | 'config' | 'debug' | null;

const activePanel = ref<PanelType>(null);

// Reset function for testing - resets module-level state
export const resetPanelState = () => {
  activePanel.value = null;
};

export const usePanels = () => {
  const router = useRouter();
  const route = useRoute();

  const isSidebarOpen = computed(() => activePanel.value === 'sidebar');
  const isConfigOpen = computed(() => activePanel.value === 'config');
  const isDebugOpen = computed(() => activePanel.value === 'debug');

  // Sync panel state with query parameters
  const syncToQuery = (panel: PanelType) => {
    const { path, query } = route;
    const newQuery = {
      ...query,
      config: panel === 'config' ? 'true' : undefined,
    };

    router.push({ path, query: newQuery });
  };

  // Initialize from query on first call
  if (route.query.config === 'true' && activePanel.value === null) {
    activePanel.value = 'config';
  }

  // Watch for external query changes
  watch(
    () => route.query.config,
    (configQuery) => {
      if (configQuery === 'true' && activePanel.value !== 'config') {
        activePanel.value = 'config';
      } else if (configQuery !== 'true' && activePanel.value === 'config') {
        activePanel.value = null;
      }
    }
  );

  const openPanel = (panel: PanelType) => {
    activePanel.value = panel;
    syncToQuery(panel);
  };

  const closePanel = () => {
    activePanel.value = null;
    syncToQuery(null);
  };

  const togglePanel = (panel: Exclude<PanelType, null>) => {
    const newPanel = activePanel.value === panel ? null : panel;
    activePanel.value = newPanel;
    syncToQuery(newPanel);
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
