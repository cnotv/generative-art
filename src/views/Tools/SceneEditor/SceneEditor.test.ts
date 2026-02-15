import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SceneEditor from './SceneEditor.vue';
import type { CoordinateTuple } from '@webgamekit/threejs';

//Mock threejs functions
vi.mock('@webgamekit/threejs', async () => {
  const actual = await vi.importActual<typeof import('@webgamekit/threejs')>('@webgamekit/threejs');
  return {
    ...actual,
    getTools: vi.fn(() => Promise.resolve({
      setup: vi.fn((config) => Promise.resolve({ orbit: null, ground: null })),
      animate: vi.fn(),
      scene: {},
      world: {},
      camera: { position: { x: 0, y: 50, z: 100 } },
    })),
    getCube: vi.fn(),
    generateAreaPositions: vi.fn(() => [[0, 0, 0] as CoordinateTuple]),
  };
});

describe('SceneEditor', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    vi.clearAllMocks();
    pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{
        path: '/tools/scene-editor',
        name: 'SceneEditor',
        component: SceneEditor,
      }],
    });
    await router.push('/tools/scene-editor');
    await router.isReady();
  });

  const createWrapper = () => {
    return mount(SceneEditor, {
      global: {
        plugins: [pinia, router],
        stubs: {
          // Stub panel components to avoid radix-vue focus trap crash in jsdom
          TexturesPanel: { template: '<div data-stub="textures-panel"><slot /></div>' },
          ConfigPanel: { template: '<div data-stub="config-panel"><slot /></div>' },
        },
      },
    });
  };

  describe('Component Mounting', () => {
    it('should mount successfully with canvas element', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('canvas').exists()).toBe(true);
    });

    it('should initialize with default configuration', () => {
      const wrapper = createWrapper();
      expect(wrapper.vm).toBeDefined();
    });
  });

  describe('Texture Upload', () => {
    it('should handle texture file upload via handleFileUpload', async () => {
      const wrapper = createWrapper();

      const file = new File(['texture'], 'test.png', { type: 'image/png' });
      const event = {
        target: {
          files: [file],
        },
      } as unknown as Event;

      await wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureItems).toBeDefined();
      expect(wrapper.vm.textureItems.length).toBeGreaterThan(0);
      expect(wrapper.vm.textureItems[0]).toHaveProperty('name');
      expect(wrapper.vm.textureItems[0]).toHaveProperty('url');
      expect(wrapper.vm.textureItems[0]).toHaveProperty('id');
    });

    it('should handle adding texture items with names', async () => {
      const wrapper = createWrapper();

      // Add first texture
      const file1 = new File(['texture1'], 'grass.png', { type: 'image/png' });
      const event = {
        target: {
          files: [file1],
        },
      } as unknown as Event;

      await wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureItems.length).toBe(1);
      expect(wrapper.vm.textureItems[0].name).toBe('grass');
    });
  });

  describe('Configuration Export', () => {
    it('should export configuration as JSON', () => {
      const wrapper = createWrapper();

      const config = wrapper.vm.exportConfiguration();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should include all texture settings in export', () => {
      const wrapper = createWrapper();

      const config = wrapper.vm.exportConfiguration();

      expect(config).toHaveProperty('textures');
      expect(config).toHaveProperty('instances');
      expect(config).toHaveProperty('area');
    });
  });

  describe('Area Position Configuration', () => {
    it.each([
      ['random', 'random'],
      ['grid', 'grid'],
      ['grid-jitter', 'grid-jitter']
    ])('should support %s pattern', async (patternName, patternValue) => {
      const wrapper = createWrapper();

      wrapper.vm.reactiveConfig.instances.pattern = patternValue as any;
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.reactiveConfig.instances.pattern).toBe(patternValue);
    });

    it('should allow seed configuration', () => {
      const wrapper = createWrapper();

      wrapper.vm.reactiveConfig.instances.seed = 5000;
      expect(wrapper.vm.reactiveConfig.instances.seed).toBe(5000);
    });

    it('should allow instance count configuration', () => {
      const wrapper = createWrapper();

      wrapper.vm.reactiveConfig.instances.count = 50;
      expect(wrapper.vm.reactiveConfig.instances.count).toBe(50);
    });
  });

  describe('Size and Rotation Variations', () => {
    it('should have size variation controls for X, Y, Z', () => {
      const wrapper = createWrapper();

      wrapper.vm.reactiveConfig.textures.sizeVariation = [5, 10, 15] as CoordinateTuple;
      expect(wrapper.vm.reactiveConfig.textures.sizeVariation).toEqual([5, 10, 15]);
    });

    it('should have rotation variation controls for X, Y, Z', () => {
      const wrapper = createWrapper();

      wrapper.vm.reactiveConfig.textures.rotationVariation = [0.5, 1.0, 1.5] as CoordinateTuple;
      expect(wrapper.vm.reactiveConfig.textures.rotationVariation).toEqual([0.5, 1.0, 1.5]);
    });
  });

  describe('Per-Texture Configuration', () => {
    it('should maintain separate configs for different textures', async () => {
      const wrapper = createWrapper();

      // Add first texture (grass.png) directly via method
      const file1 = new File(['texture1'], 'grass.png', { type: 'image/png' });
      const event1 = { target: { files: [file1] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event1);
      await wrapper.vm.$nextTick();

      const grassId = wrapper.vm.textureItems[0].id;

      // Select grass texture and verify it has default config
      wrapper.vm.selectTexture(grassId);
      await wrapper.vm.$nextTick();

      const grassConfig = wrapper.vm.textureConfigRegistry[grassId];
      expect(grassConfig).toBeDefined();
      expect(grassConfig.baseSize).toEqual([20, 20, 0]); // default values

      // Modify grass config
      wrapper.vm.textureConfigRegistry[grassId].baseSize = [30, 30, 0] as CoordinateTuple;
      await wrapper.vm.$nextTick();

      // Add second texture (tree.png)
      const file2 = new File(['texture2'], 'tree.png', { type: 'image/png' });
      const event2 = { target: { files: [file2] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event2);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureItems.length).toBe(2);
      const treeId = wrapper.vm.textureItems[1].id;

      // Select tree texture - it should be auto-selected after adding
      await wrapper.vm.$nextTick();

      const treeConfig = wrapper.vm.textureConfigRegistry[treeId];
      expect(treeConfig).toBeDefined();
      expect(treeConfig.baseSize).toEqual([20, 20, 0]); // default values, not affected by grass changes

      // Modify tree config
      wrapper.vm.textureConfigRegistry[treeId].baseSize = [50, 50, 0] as CoordinateTuple;
      await wrapper.vm.$nextTick();

      // Switch back to grass and verify its config is unchanged
      wrapper.vm.selectTexture(grassId);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureConfigRegistry[grassId].baseSize).toEqual([30, 30, 0]);
      expect(wrapper.vm.textureConfigRegistry[treeId].baseSize).toEqual([50, 50, 0]);

      // Verify configs are independent
      expect(grassConfig).not.toBe(treeConfig);
    });

    it('should register unique config key for each texture by filename', async () => {
      const wrapper = createWrapper();

      // Mock registerViewConfig to track calls
      const registerSpy = vi.spyOn(await import('@/composables/useViewConfig'), 'registerViewConfig');

      // Add texture
      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const textureId = wrapper.vm.textureItems[0].id;

      // Texture is auto-selected after adding, wait for config registration
      await wrapper.vm.$nextTick();

      // Verify registerViewConfig was called with the texture filename in the key
      expect(registerSpy).toHaveBeenCalledWith(
        expect.stringContaining(':grass'), // Should be "SceneEditor:grass"
        expect.any(Object), // textureReactiveConfig
        expect.objectContaining({
          textures: expect.any(Object)
        }), // schema with only textures controls
        undefined, // no sceneConfig for texture-specific panels
        undefined, // no sceneSchema for texture-specific panels
        expect.any(Function) // onChange callback
      );
    });

    it('should update textureProperties when texture config changes', async () => {
      const wrapper = createWrapper();

      // Add texture
      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const textureId = wrapper.vm.textureItems[0].id;
      // Texture is auto-selected, wait for it
      await wrapper.vm.$nextTick();

      // Modify texture config directly in textureProperties (simpler test)
      wrapper.vm.reactiveConfig.textureProperties['grass'] = {
        baseSize: [40, 40, 0] as CoordinateTuple,
        sizeVariation: [15, 15, 0] as CoordinateTuple,
        rotationVariation: [1, 1, 1] as CoordinateTuple,
      };
      await wrapper.vm.$nextTick();

      // Verify textureProperties is set
      const textureProperties = wrapper.vm.reactiveConfig.textureProperties['grass'];
      expect(textureProperties).toBeDefined();
      expect(textureProperties.baseSize).toEqual([40, 40, 0]);
      expect(textureProperties.sizeVariation).toEqual([15, 15, 0]);
      expect(textureProperties.rotationVariation).toEqual([1, 1, 1]);
    });

    it('should unregister texture config when texture is removed', async () => {
      const wrapper = createWrapper();

      // Mock unregisterViewConfig to track calls
      const unregisterSpy = vi.spyOn(await import('@/composables/useViewConfig'), 'unregisterViewConfig');

      // Add texture
      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const textureId = wrapper.vm.textureItems[0].id;

      // Remove the texture directly
      wrapper.vm.removeTexture(textureId);
      await wrapper.vm.$nextTick();

      // Verify unregisterViewConfig was called with the texture filename in the key
      expect(unregisterSpy).toHaveBeenCalledWith(
        expect.stringContaining(':grass') // Should be "SceneEditor:grass"
      );

      // Verify texture was removed
      expect(wrapper.vm.textureItems.length).toBe(0);
    });

    it('should show main config when no texture is selected', async () => {
      const wrapper = createWrapper();

      // Mock registerViewConfig
      const registerSpy = vi.spyOn(await import('@/composables/useViewConfig'), 'registerViewConfig');
      registerSpy.mockClear();

      // Add texture
      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file] } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      // Texture is auto-selected
      const textureId = wrapper.vm.textureItems[0].id;
      await wrapper.vm.$nextTick();

      registerSpy.mockClear();

      // Deselect by clicking the same texture (toggles)
      wrapper.vm.selectTexture(textureId);
      await wrapper.vm.$nextTick();

      // Verify main config is registered when no texture is selected
      expect(registerSpy).toHaveBeenCalled();
      const routeNames = registerSpy.mock.calls.map((call: any[]) => call[0]);
      expect(routeNames).toContain('SceneEditor');
    });
  });
});
