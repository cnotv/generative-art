import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import PathfinderThreejs from './PathfinderThreejs.vue';

vi.mock('@/composables/usePanels', () => ({
  usePanels: () => ({
    isConfigOpen: computed(() => true),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    togglePanel: vi.fn(),
    activePanels: computed(() => new Set(['config'])),
    isSidebarOpen: computed(() => false),
    isDebugOpen: computed(() => false),
    isTexturesOpen: computed(() => false),
    isSceneOpen: computed(() => false),
  }),
  resetPanelState: vi.fn(),
}));

vi.mock('@webgamekit/threejs', async () => {
  const actual = await vi.importActual<typeof import('@webgamekit/threejs')>('@webgamekit/threejs');
  return {
    ...actual,
    getTools: vi.fn(() =>
      Promise.resolve({
        setup: vi.fn(() => Promise.resolve({ orbit: null, ground: null })),
        renderer: {
          setSize: vi.fn(),
          domElement: document.createElement('canvas'),
          render: vi.fn(),
        },
        scene: {
          add: vi.fn(),
          remove: vi.fn(),
          background: null,
          children: [],
        },
        world: { step: vi.fn() },
        getDelta: vi.fn(() => 0.016),
      })
    ),
    getCube: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0.15, z: 0 },
      userData: {},
      rotation: { y: 0 },
    })),
    getModel: vi.fn(() =>
      Promise.resolve({
        position: { set: vi.fn(), x: 0, y: -1, z: 0 },
        userData: {},
        rotation: { y: 0 },
      })
    ),
  };
});

vi.mock('@webgamekit/animation', async () => {
  const actual = await vi.importActual<typeof import('@webgamekit/animation')>('@webgamekit/animation');
  return {
    ...actual,
    createTimelineManager: vi.fn(() => ({
      addAction: vi.fn(),
      removeAction: vi.fn(),
      getTimeline: vi.fn(() => []),
    })),
    animateTimeline: vi.fn(),
    updateAnimation: vi.fn(),
  };
});

describe('PathfinderThreejs', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    vi.clearAllMocks();

    pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/experiments/PathfinderThreejs',
          name: 'PathfinderThreejs',
          component: PathfinderThreejs,
        },
      ],
    });

    await router.push('/experiments/PathfinderThreejs');
    await router.isReady();
  });

  const createWrapper = () =>
    mount(PathfinderThreejs, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ConfigPanel: { template: '<div data-stub="config-panel" />' },
          ScenePanel: { template: '<div data-stub="scene-panel" />' },
        },
      },
      attachTo: document.body,
    });

  describe('Component mounting', () => {
    it('mounts with a canvas element', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('canvas').exists()).toBe(true);
    });
  });

  describe('Canvas rendering', () => {
    it('renders no action buttons in the view (they live in the config panel)', () => {
      const wrapper = createWrapper();
      // Actions are registered via schema callbacks and rendered by the config panel
      expect(wrapper.findAll('button')).toHaveLength(0);
    });
  });
});
