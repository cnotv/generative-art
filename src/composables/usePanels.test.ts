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
  sidebar: 'false',
  config: 'false',
  scene: 'false',
  debug: 'false',
  textures: 'false',
  camera: 'false',
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

  describe('sidebar panel', () => {
    it('should sync sidebar query param', async () => {
      const { togglePanel, isSidebarOpen } = usePanels();

      togglePanel('sidebar');
      await nextTick();

      expect(isSidebarOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, sidebar: 'true' },
      });
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
    it('should allow multiple panels to be open simultaneously', async () => {
      const { togglePanel, isConfigOpen, isSidebarOpen, isTexturesOpen } = usePanels();

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      togglePanel('sidebar');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSidebarOpen.value).toBe(true);

      togglePanel('textures');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSidebarOpen.value).toBe(true);
      expect(isTexturesOpen.value).toBe(true);

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);
      expect(isSidebarOpen.value).toBe(true);
      expect(isTexturesOpen.value).toBe(true);
    });

    it('should close specific panel with closePanel', async () => {
      const { openPanel, closePanel, isConfigOpen, isSidebarOpen } = usePanels();

      openPanel('config');
      openPanel('sidebar');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);
      expect(isSidebarOpen.value).toBe(true);

      closePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(false);
      expect(isSidebarOpen.value).toBe(true);
    });
  });

  describe('getPanelOffset', () => {
    it.each([
      // Right-side panels — single panel open always has offset 0
      ['debug', ['debug'], 0],
      ['camera', ['camera'], 0],
      ['scene', ['scene'], 0],
      ['config', ['config'], 0],
      // Right-side panels — multiple open, offset by count of panels closer to edge
      ['config', ['debug', 'config'], 1],
      ['config', ['camera', 'config'], 1],
      ['config', ['debug', 'camera', 'config'], 2],
      ['scene', ['debug', 'scene'], 1],
      ['camera', ['debug', 'camera'], 1],
      ['debug', ['debug', 'camera', 'scene', 'config'], 0],
      ['camera', ['debug', 'camera', 'scene', 'config'], 1],
      ['scene', ['debug', 'camera', 'scene', 'config'], 2],
      ['config', ['debug', 'camera', 'scene', 'config'], 3],
      // Left-side panels
      ['sidebar', ['sidebar'], 0],
      ['textures', ['textures'], 0],
      ['textures', ['sidebar', 'textures'], 1],
      ['sidebar', ['sidebar', 'textures'], 0],
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
