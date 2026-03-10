import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as THREE from 'three';

// Mock vue-router (required by panels store)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {}, path: '/test' }),
}));

// Mock Three.js scene children
const mockScene = {
  children: [] as Array<{ name: string; type: string; visible: boolean }>,
  getObjectByName: vi.fn((name: string) => {
    if (name === 'ambient-light') return { intensity: 1, color: new THREE.Color(0xffffff) };
    if (name === 'directional-light') return { intensity: 2, color: new THREE.Color(0xffffff), position: new THREE.Vector3(50, 100, 50) };
    if (name === 'sky') return { material: { color: new THREE.Color(0xaaaaff) }, geometry: { dispose: vi.fn() } };
    return null;
  }),
  remove: vi.fn(),
  add: vi.fn(),
};

const mockCamera = {
  type: 'PerspectiveCamera',
  position: new THREE.Vector3(0, 5, 10),
  fov: 75,
  updateProjectionMatrix: vi.fn(),
};

const mockOrbit = {
  target: new THREE.Vector3(0, 0, 0),
  update: vi.fn(),
  addEventListener: vi.fn(),
};

const mockGround = {
  mesh: {
    material: { color: new THREE.Color(0x888888) },
    geometry: { dispose: vi.fn() },
  },
};

// Mock getTools
vi.mock('@webgamekit/threejs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getTools: vi.fn(() => Promise.resolve({
      setup: vi.fn(() => Promise.resolve({ orbit: mockOrbit, ground: mockGround })),
      animate: vi.fn(),
      scene: mockScene,
      camera: mockCamera,
      world: {},
    })),
  };
});

vi.mock('@webgamekit/animation', () => ({
  createTimelineManager: vi.fn(() => ({})),
}));

vi.mock('@/utils/groupMeshes', () => ({
  addGroupMeshes: vi.fn(),
  removeGroupMeshes: vi.fn(),
}));

// Import after mocks
import { useSceneViewStore } from './sceneView';
import { usePanelsStore } from './panels';
import { useViewPanelsStore } from './viewPanels';
import { useDebugSceneStore } from './debugScene';
import { useElementPropertiesStore } from './elementProperties';
import { useTextureGroupsStore } from './textureGroups';

describe('useSceneViewStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScene.children = [];
    setActivePinia(createPinia());
  });

  describe('init', () => {
    it('should set isInitialized after successful init', async () => {
      const store = useSceneViewStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, {
        camera: { position: [0, 5, 10], fov: 75 },
      });

      expect(store.isInitialized).toBe(true);
    });

    it('should call setViewPanels and openPanel', async () => {
      const store = useSceneViewStore();
      const panelsStore = usePanelsStore();
      const viewPanelsStore = useViewPanelsStore();
      const canvas = document.createElement('canvas');

      panelsStore.initRouteSync();
      await store.init(canvas, { camera: { position: [0, 5, 10] } });

      expect(viewPanelsStore.viewPanels).toEqual({ showConfig: false });
      expect(panelsStore.activePanels.has('elements')).toBe(true);
    });

    it('should register element properties for camera when camera config is provided', async () => {
      const store = useSceneViewStore();
      const elementPropertiesStore = useElementPropertiesStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, {
        camera: { position: [0, 5, 10], fov: 75 },
      });

      expect(elementPropertiesStore.selectedElementName).toBe(null);
      elementPropertiesStore.openElementProperties('Camera');
      expect(elementPropertiesStore.activeProperties).not.toBe(null);
      expect(elementPropertiesStore.activeProperties?.title).toBe('Camera');
    });

    it.each([
      ['ground', { ground: { color: 0x888888, size: [100, 0.1, 100] as [number, number, number] } }, 'Ground'],
      ['sky', { sky: { color: 0xaaaaff, size: 1000 } }, 'Sky'],
    ] as const)('should register element properties for %s', async (name, config, expectedTitle) => {
      const store = useSceneViewStore();
      const elementPropertiesStore = useElementPropertiesStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, config);

      elementPropertiesStore.openElementProperties(name);
      expect(elementPropertiesStore.activeProperties?.title).toBe(expectedTitle);
    });

    it('should register lights element properties', async () => {
      const store = useSceneViewStore();
      const elementPropertiesStore = useElementPropertiesStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, {
        lights: { ambient: { color: 0xffffff, intensity: 1 } },
      });

      elementPropertiesStore.openElementProperties('lights');
      expect(elementPropertiesStore.activeProperties?.title).toBe('Lights');
    });

    it('should set scene elements in debug store', async () => {
      const store = useSceneViewStore();
      const debugSceneStore = useDebugSceneStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, {
        camera: { position: [0, 5, 10] },
      });

      expect(debugSceneStore.sceneElements.length).toBeGreaterThan(0);
      expect(debugSceneStore.sceneElements[0].name).toBe('Camera');
    });

    it('should sync orbit controls change listener', async () => {
      const store = useSceneViewStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, {
        camera: { position: [0, 5, 10] },
      });

      expect(mockOrbit.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('initTextureGroups', () => {
    it('should push groups to texture store', async () => {
      const store = useSceneViewStore();
      const textureStore = useTextureGroupsStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, { camera: { position: [0, 5, 10] } });
      store.initTextureGroups(
        [{ id: 'cloud', name: 'Cloud', textures: [{ id: 't1', name: 'cloud1', filename: 'cloud1', url: 'test.webp' }] }],
        { cloud: 'Cloud' }
      );

      expect(textureStore.groups).toHaveLength(1);
      expect(textureStore.groups[0].id).toBe('cloud');
    });

    it('should register texture group handlers', async () => {
      const store = useSceneViewStore();
      const textureStore = useTextureGroupsStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, { camera: { position: [0, 5, 10] } });
      store.initTextureGroups(
        [{ id: 'cloud', name: 'Cloud', textures: [] }],
        { cloud: 'Cloud' }
      );

      expect(textureStore.handlers).not.toBe(null);
      expect(textureStore.handlers?.onToggleVisibility).toBeDefined();
      expect(textureStore.handlers?.onToggleWireframe).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clear all stores and reset refs', async () => {
      const store = useSceneViewStore();
      const debugSceneStore = useDebugSceneStore();
      const elementPropertiesStore = useElementPropertiesStore();
      const textureStore = useTextureGroupsStore();
      const canvas = document.createElement('canvas');

      await store.init(canvas, { camera: { position: [0, 5, 10] } });
      store.cleanup();

      expect(store.isInitialized).toBe(false);
      expect(store.threeScene).toBe(null);
      expect(store.threeCamera).toBe(null);
      expect(debugSceneStore.sceneElements).toEqual([]);
      expect(elementPropertiesStore.activeProperties).toBe(null);
      expect(textureStore.groups).toEqual([]);
    });
  });
});
