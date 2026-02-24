import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type PanelType = 'sidebar' | 'config' | 'scene' | 'debug' | 'textures' | 'camera';

const ALL_PANEL_TYPES: PanelType[] = ['sidebar', 'config', 'scene', 'debug', 'textures', 'camera'];

// Panels stacked from edge inward; index 0 = closest to viewport edge
const RIGHT_PANEL_ORDER: PanelType[] = ['debug', 'camera', 'scene', 'config'];
const LEFT_PANEL_ORDER: PanelType[] = ['sidebar', 'textures'];

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
  const isSceneOpen = computed(() => activePanels.value.has('scene'));

  // Returns the number of open panels stacked closer to the viewport edge on the same side.
  // Used to offset panels so they appear side-by-side instead of overlapping.
  const getPanelOffset = (panelType: PanelType): number => {
    const rightIndex = RIGHT_PANEL_ORDER.indexOf(panelType);
    if (rightIndex !== -1) {
      return RIGHT_PANEL_ORDER.slice(0, rightIndex).filter(p => activePanels.value.has(p)).length;
    }
    const leftIndex = LEFT_PANEL_ORDER.indexOf(panelType);
    if (leftIndex !== -1) {
      return LEFT_PANEL_ORDER.slice(0, leftIndex).filter(p => activePanels.value.has(p)).length;
    }
    return 0;
  };

  const syncToQuery = () => {
    const { path, query } = route;
    const panelQuery = ALL_PANEL_TYPES.reduce<Record<string, string>>(
      (accumulator, panel) => ({ ...accumulator, [panel]: activePanels.value.has(panel) ? 'true' : 'false' }),
      {}
    );
    router.push({ path, query: { ...query, ...panelQuery } });
  };

  // Initialize from query on first call
  ALL_PANEL_TYPES.forEach(panel => {
    if (route.query[panel] === 'true' && !activePanels.value.has(panel)) {
      activePanels.value.add(panel);
    }
  });

  // Watch for external query changes for all panel types
  ALL_PANEL_TYPES.forEach(panel => {
    watch(
      () => route.query[panel],
      (value) => {
        if (value === 'true' && !activePanels.value.has(panel)) {
          activePanels.value.add(panel);
        } else if (value !== 'true' && activePanels.value.has(panel)) {
          activePanels.value.delete(panel);
        }
      }
    );
  });

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

  const closeAllPanels = () => {
    activePanels.value = new Set();
    syncToQuery();
  };

  return {
    activePanels: computed(() => activePanels.value),
    isSidebarOpen,
    isConfigOpen,
    isDebugOpen,
    isTexturesOpen,
    isSceneOpen,
    getPanelOffset,
    openPanel,
    closePanel,
    togglePanel,
    closeAllPanels,
  };
};
