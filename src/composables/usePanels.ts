import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type PanelType = 'navigation' | 'config' | 'scene' | 'debug' | 'elements';

const ALL_PANEL_TYPES: PanelType[] = ['navigation', 'config', 'scene', 'debug', 'elements'];

// Panels stacked from edge inward; index 0 = closest to viewport edge
const RIGHT_PANEL_ORDER: PanelType[] = ['debug', 'scene', 'config'];
const LEFT_PANEL_ORDER: PanelType[] = ['elements'];

const activePanels = ref<Set<PanelType>>(new Set());
const syncInitialized = ref(false);

// Reset function for testing - resets module-level state
export const resetPanelState = () => {
  activePanels.value = new Set();
  syncInitialized.value = false;
};

export const usePanels = () => {
  const router = useRouter();
  const route = useRoute();

  const isNavigationOpen = computed(() => activePanels.value.has('navigation'));
  const isConfigOpen = computed(() => activePanels.value.has('config'));
  const isDebugOpen = computed(() => activePanels.value.has('debug'));
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

  // Run initialization and route watchers only once across all usePanels() callers.
  // Multiple components calling usePanels() would otherwise create duplicate watchers
  // that all fire on every route.query change and create competing reactive updates.
  if (!syncInitialized.value) {
    syncInitialized.value = true;

    const initialOpen = ALL_PANEL_TYPES.filter(panel => route.query[panel] === 'true' && !activePanels.value.has(panel));
    if (initialOpen.length > 0) {
      activePanels.value = new Set([...activePanels.value, ...initialOpen]);
    }

    ALL_PANEL_TYPES.forEach(panel => {
      watch(
        () => route.query[panel],
        (value) => {
          const isOpen = activePanels.value.has(panel);
          if (value === 'true' && !isOpen) {
            activePanels.value = new Set([...activePanels.value, panel]);
          } else if (value !== 'true' && isOpen) {
            activePanels.value = new Set([...activePanels.value].filter(p => p !== panel));
          }
        }
      );
    });
  }

  // Navigation is mutually exclusive: opening it closes all others, and vice versa.
  const withMutualExclusion = (panel: PanelType, current: Set<PanelType>): Set<PanelType> => {
    if (panel === 'navigation') return new Set(['navigation']);
    return new Set([...[...current].filter(p => p !== 'navigation'), panel]);
  };

  const openPanel = (panel: PanelType) => {
    activePanels.value = withMutualExclusion(panel, activePanels.value);
    syncToQuery();
  };

  const closePanel = (panel: PanelType) => {
    activePanels.value = new Set([...activePanels.value].filter(p => p !== panel));
    syncToQuery();
  };

  const togglePanel = (panel: PanelType) => {
    activePanels.value = activePanels.value.has(panel)
      ? new Set([...activePanels.value].filter(p => p !== panel))
      : withMutualExclusion(panel, activePanels.value);
    syncToQuery();
  };

  const closeAllPanels = () => {
    activePanels.value = new Set();
    syncToQuery();
  };

  return {
    activePanels: computed(() => activePanels.value),
    isNavigationOpen,
    isConfigOpen,
    isDebugOpen,
    isSceneOpen,
    getPanelOffset,
    openPanel,
    closePanel,
    togglePanel,
    closeAllPanels,
  };
};
