import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import DrawPath from './DrawPath.vue';

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
        camera: {
          position: { set: vi.fn(), x: 0, y: 15, z: 25 },
          lookAt: vi.fn(),
          updateProjectionMatrix: vi.fn(),
          fov: 60,
        },
        world: { step: vi.fn() },
        getDelta: vi.fn(() => 0.016),
      })
    ),
    getBall: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0.5, z: 0 },
      userData: { body: { setNextKinematicTranslation: vi.fn() } },
      rotation: { y: 0 },
      visible: true,
    })),
    getCube: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0.75, z: 0 },
      userData: { body: null },
      rotation: { y: 0 },
      visible: true,
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() },
    })),
    getModel: vi.fn(() =>
      Promise.resolve({
        position: { set: vi.fn(), x: 0, y: 0.5, z: 0 },
        userData: { body: { setNextKinematicTranslation: vi.fn() }, actions: {}, mixer: null },
        rotation: { y: 0 },
        visible: false,
      })
    ),
  };
});

vi.mock('@webgamekit/animation', async () => {
  const actual = await vi.importActual<typeof import('@webgamekit/animation')>('@webgamekit/animation');
  return {
    ...actual,
    updateAnimation: vi.fn(),
  };
});

describe('DrawPath', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    vi.clearAllMocks();

    pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/experiments/DrawPath',
          name: 'DrawPath',
          component: DrawPath,
        },
      ],
    });

    await router.push('/experiments/DrawPath');
    await router.isReady();
  });

  const createWrapper = () =>
    mount(DrawPath, {
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
    it('renders no action buttons in the view (controls live in config panel)', () => {
      const wrapper = createWrapper();
      expect(wrapper.findAll('button')).toHaveLength(0);
    });
  });
});
