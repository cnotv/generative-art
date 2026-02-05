import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';

// Mock route query
const mockQuery = ref<Record<string, string | undefined>>({});
const mockPath = ref('/test');
const mockPush = vi.fn();

// Reset module state between tests
const activePanelReset: (() => void) | null = null;

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
import { usePanels } from './usePanels';

describe('usePanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {};
    mockPath.value = '/test';
    // Reset panel state by closing any open panel
    const { closePanel } = usePanels();
    closePanel();
    vi.clearAllMocks(); // Clear the mock calls from reset
  });

  describe('togglePanel', () => {
    it('should open config panel and sync query param', async () => {
      const { togglePanel, isConfigOpen } = usePanels();

      togglePanel('config');
      await nextTick();

      expect(isConfigOpen.value).toBe(true);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { config: 'true' },
      });
    });

    it('should close config panel and remove query param', async () => {
      // Start with config open
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
        query: { config: undefined },
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
      closePanel();
      await nextTick();

      expect(isConfigOpen.value).toBe(false);
      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { config: undefined },
      });
    });

    it('should preserve other query params when closing', async () => {
      mockQuery.value = { config: 'true', other: 'value' };
      const { closePanel } = usePanels();

      closePanel();
      await nextTick();

      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { config: undefined, other: 'value' },
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
        query: { config: 'true' },
      });
    });
  });

  describe('sidebar panel', () => {
    it('should not add query param for sidebar', async () => {
      const { togglePanel, isSidebarOpen } = usePanels();

      togglePanel('sidebar');
      await nextTick();

      expect(isSidebarOpen.value).toBe(true);
      // Should still push but with config: undefined (no sidebar param)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { config: undefined },
      });
    });
  });

  describe('query param initialization', () => {
    it('should open config panel if query param is present on init', async () => {
      mockQuery.value = { config: 'true' };

      // Re-import to test initialization
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
        query: { config: 'true' },
      });

      vi.clearAllMocks();

      // Simulate overlay click by calling closePanel (what handleOpenChange does)
      closePanel();
      await nextTick();

      // Panel should be closed
      expect(isConfigOpen.value).toBe(false);
      // URL should be updated with config: undefined
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { config: undefined },
      });
    });

    it('should update URL even when called multiple times', async () => {
      const { togglePanel, closePanel, isConfigOpen } = usePanels();

      // Open -> Close -> Open -> Close
      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      closePanel();
      await nextTick();
      expect(isConfigOpen.value).toBe(false);

      togglePanel('config');
      await nextTick();
      expect(isConfigOpen.value).toBe(true);

      closePanel();
      await nextTick();
      expect(isConfigOpen.value).toBe(false);

      // Should have been called 4 times (open, close, open, close)
      expect(mockPush).toHaveBeenCalledTimes(4);
    });
  });
});
