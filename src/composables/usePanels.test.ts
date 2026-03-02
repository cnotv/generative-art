import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';

// Mock route query
const mockQuery = ref<Record<string, string | undefined>>({});
const mockPath = ref('/test');
const mockPush = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    get query() {
      return mockQuery.value;
    },
    get path() {
      return mockPath.value;
    },
  }),
}));

// Import after mocking
import { usePanels, resetPanelState } from './usePanels';

// All panel keys synced to URL; closed panels use 'false'
const allPanelsClosed = {
  navigation: 'false',
  config: 'false',
  scene: 'false',
  debug: 'false',
  elements: 'false',
};

describe('usePanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {};
    mockPath.value = '/test';
    resetPanelState();
  });

  describe('togglePanel', () => {
    it('should open config panel and sync query param', async () => {
      const { togglePanel, isConfigOpen } = usePanels();

      togglePanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' },
      });
    });

    it('should close config panel and remove query param', async () => {
      mockQuery.value = { config: 'true' };
      const { togglePanel, isConfigOpen } = usePanels();

      // First toggle opens it
      togglePanel('config');
      await nextTick();

      // Second toggle closes it
      togglePanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(false);
      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { ...allPanelsClosed },
      });
    });
  });

  describe('closePanel', () => {
    it('should close panel and remove query param', async () => {
      const { togglePanel, closePanel, isConfigOpen } = usePanels();

      // Open first
      togglePanel('config');
      await nextTick();

      // Then close
      closePanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(false);
      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { ...allPanelsClosed },
      });
    });

    it('should preserve other query params when closing', async () => {
      mockQuery.value = { config: 'true', other: 'value' };
      const { closePanel } = usePanels();

      closePanel('config');
      await nextTick();

      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, other: 'value' },
      });
    });
  });

  describe('openPanel', () => {
    it('should open panel and add query param', async () => {
      const { openPanel, isConfigOpen } = usePanels();

      openPanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' },
      });
    });
  });

  describe('navigation panel', () => {
    it('should sync navigation query param', async () => {
      const { togglePanel, isNavigationOpen } = usePanels();

      togglePanel('navigation');
      await nextTick();

      expect(isNavigationOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, navigation: 'true' },
      });
    });
  });

  describe('mutual exclusion', () => {
    it('should close all other panels when navigation is opened', async () => {
      const { openPanel, togglePanel, isNavigationOpen, isConfigOpen, isSceneOpen } = usePanels();

      openPanel('config');
      openPanel('scene');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSceneOpen.value).toBe(true);

      togglePanel('navigation');
      await nextTick();

      expect(isNavigationOpen.value).toBe(true);
      expect(isConfigOpen.value).toBe(false);
      expect(isSceneOpen.value).toBe(false);
    });

    it('should close navigation when any other panel is opened', async () => {
      const { openPanel, togglePanel, isNavigationOpen, isConfigOpen } = usePanels();

      togglePanel('navigation');
      await nextTick();
      expect(isNavigationOpen.value).toBe(true);

      openPanel('config');
      await nextTick();

      expect(isNavigationOpen.value).toBe(false);
      expect(isConfigOpen.value).toBe(true);
    });

    it('should close navigation when toggling another panel open', async () => {
      const { togglePanel, isNavigationOpen, isDebugOpen } = usePanels();

      togglePanel('navigation');
      await nextTick();
      expect(isNavigationOpen.value).toBe(true);

      togglePanel('debug');
      await nextTick();

      expect(isNavigationOpen.value).toBe(false);
      expect(isDebugOpen.value).toBe(true);
    });
  });

  describe('query param initialization', () => {
    it('should open config panel if query param is present on init', async () => {
      mockQuery.value = { config: 'true' };

      const { isConfigOpen } = usePanels();
      await nextTick();

      expect(isConfigOpen.value).toBe(true);
    });
  });

  describe('overlay click simulation (handleOpenChange)', () => {
    it('should close panel and update URL when overlay is clicked', async () => {
      const { togglePanel, closePanel, isConfigOpen } = usePanels();

      // Open the panel first
      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' },
      });

      vi.clearAllMocks();

      // Simulate overlay click by calling closePanel (what handleOpenChange does)
      closePanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(false);
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed },
      });
    });

    it('should update URL even when called multiple times', async () => {
      const { togglePanel, closePanel, isConfigOpen } = usePanels();

      // Open -> Close -> Open -> Close
      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      closePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      closePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);

      // Should have been called 4 times (open, close, open, close)
      expect(mockPush).toHaveBeenCalledTimes(4);
    });
  });

  describe('multiple panels', () => {
    it('should allow multiple non-navigation panels to be open simultaneously', async () => {
      const { togglePanel, isConfigOpen, isSceneOpen } = usePanels();

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      togglePanel('scene');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSceneOpen.value).toBe(true);

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);
      expect(isSceneOpen.value).toBe(true);
    });

    it('should close specific panel with closePanel', async () => {
      const { openPanel, closePanel, isConfigOpen, isSceneOpen } = usePanels();

      openPanel('config');
      openPanel('scene');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSceneOpen.value).toBe(true);

      closePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);
      expect(isSceneOpen.value).toBe(true);
    });
  });

  describe('getPanelOffset', () => {
    it.each([
      // Right-side panels — single panel open always has offset 0
      ['debug', ['debug'], 0],
      ['scene', ['scene'], 0],
      ['config', ['config'], 0],
      // Right-side panels — multiple open, offset by count of panels closer to edge
      ['config', ['debug', 'config'], 1],
      ['config', ['scene', 'config'], 1],
      ['config', ['debug', 'scene', 'config'], 2],
      ['scene', ['debug', 'scene'], 1],
      ['debug', ['debug', 'scene', 'config'], 0],
      ['scene', ['debug', 'scene', 'config'], 1],
      ['config', ['debug', 'scene', 'config'], 2],
      // Left-side panels — single panel open always has offset 0
      ['elements', ['elements'], 0],
    ] as const)(
      'getPanelOffset(%s) with open panels %j → %d',
      async (panelType, openPanels, expectedOffset) => {
        const { openPanel, getPanelOffset } = usePanels();

        openPanels.forEach(p => openPanel(p));
        await nextTick();

        expect(getPanelOffset(panelType)).toBe(expectedOffset);
      }
    );
  });
});
