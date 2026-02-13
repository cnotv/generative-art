import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

// Panel types including textures for SceneEditor sidebar
export type PanelType = 'sidebar' | 'config' | 'debug' | 'textures' | 'recording';

const activePanels = ref<Set<PanelType>>(new Set());

// Reset function for testing - resets module-level state
export const resetPanelState = () => {
  activePanels.value = new Set();
};

export const usePanels = () => {
  const router = useRouter();
  const route = useRoute();

  const isSidebarOpen = computed(() => activePanels.value.has('sidebar'));
  const isConfigOpen = computed(() => activePanels.value.has('config'));
  const isDebugOpen = computed(() => activePanels.value.has('debug'));
  const isTexturesOpen = computed(() => activePanels.value.has('textures'));

  // Sync panel state with query parameters
  const syncToQuery = () => {
    const { path, query } = route;
    const newQuery = {
      ...query,
      config: activePanels.value.has('config') ? 'true' : 'false',
    };

    router.push({ path, query: newQuery });
  };

  // Initialize from query on first call
  if (route.query.config === 'true' && !activePanels.value.has('config')) {
    activePanels.value.add('config');
  }

  // Watch for external query changes
  watch(
    () => route.query.config,
    (configQuery) => {
      if (configQuery === 'true' && !activePanels.value.has('config')) {
        activePanels.value.add('config');
      } else if (configQuery !== 'true' && activePanels.value.has('config')) {
        activePanels.value.delete('config');
      }
    }
  );

  const openPanel = (panel: PanelType) => {
    activePanels.value.add(panel);
    syncToQuery();
  };

  const closePanel = (panel: PanelType) => {
    activePanels.value.delete(panel);
    syncToQuery();
  };

  const togglePanel = (panel: PanelType) => {
    if (activePanels.value.has(panel)) {
      activePanels.value.delete(panel);
    } else {
      activePanels.value.add(panel);
    }
    syncToQuery();
  };

  return {
    activePanels: computed(() => activePanels.value),
    isSidebarOpen,
    isConfigOpen,
    isDebugOpen,
    isTexturesOpen,
    openPanel,
    closePanel,
    togglePanel,
  };
};
