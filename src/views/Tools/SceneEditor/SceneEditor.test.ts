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
      scene: { children: [], remove: vi.fn() },
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
          value: '',
        },
      } as unknown as Event;

      await wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureGroups).toBeDefined();
      expect(wrapper.vm.textureGroups.length).toBeGreaterThan(0);
      expect(wrapper.vm.textureGroups[0]).toHaveProperty('name');
      expect(wrapper.vm.textureGroups[0].textures[0]).toHaveProperty('url');
      expect(wrapper.vm.textureGroups[0].textures[0]).toHaveProperty('id');
    });

    it('should handle adding texture items with names', async () => {
      const wrapper = createWrapper();

      // Add first texture
      const file1 = new File(['texture1'], 'grass.png', { type: 'image/png' });
      const event = {
        target: {
          files: [file1],
          value: '',
        },
      } as unknown as Event;

      await wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureGroups.length).toBe(1);
      expect(wrapper.vm.textureGroups[0].name).toBe('grass');
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

      wrapper.vm.reactiveConfig.instances.density = 50;
      expect(wrapper.vm.reactiveConfig.instances.density).toBe(50);
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

  describe('Per-Group Configuration', () => {
    it('should maintain separate configs for different groups', async () => {
      const wrapper = createWrapper();

      // Add first texture group (grass.png)
      const file1 = new File(['texture1'], 'grass.png', { type: 'image/png' });
      const event1 = { target: { files: [file1], value: '' } } as unknown as Event;
      wrapper.vm.handleFileUpload(event1);
      await wrapper.vm.$nextTick();

      const grassGroupId = wrapper.vm.textureGroups[0].id;

      // Verify group config was created in registry
      expect(wrapper.vm.groupConfigRegistry['grass']).toBeDefined();

      // Modify grass config via reactiveConfig (group is auto-selected)
      wrapper.vm.reactiveConfig.textures.baseSize = [30, 30, 0] as CoordinateTuple;
      await wrapper.vm.$nextTick();

      // Add second texture group (tree.png) — this saves grass config and selects tree
      const file2 = new File(['texture2'], 'tree.png', { type: 'image/png' });
      const event2 = { target: { files: [file2], value: '' } } as unknown as Event;
      wrapper.vm.handleFileUpload(event2);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureGroups.length).toBe(2);

      // Tree should have default config
      expect(wrapper.vm.groupConfigRegistry['tree']).toBeDefined();
      expect(wrapper.vm.groupConfigRegistry['tree'].textures.baseSize).toEqual([20, 20, 0]);

      // Grass config should have been saved with modified values
      expect(wrapper.vm.groupConfigRegistry['grass'].textures.baseSize).toEqual([30, 30, 0]);
    });

    it('should initialize group config with default values', async () => {
      const wrapper = createWrapper();

      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const groupConfig = wrapper.vm.groupConfigRegistry['grass'];
      expect(groupConfig).toBeDefined();
      expect(groupConfig.textures.baseSize).toEqual([20, 20, 0]);
      expect(groupConfig.instances.density).toBe(0);
      expect(groupConfig.instances.pattern).toBe('random');
    });

    it('should remove group config when group is removed', async () => {
      const wrapper = createWrapper();

      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const groupId = wrapper.vm.textureGroups[0].id;

      expect(wrapper.vm.groupConfigRegistry['grass']).toBeDefined();

      wrapper.vm.removeGroup(groupId);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.groupConfigRegistry['grass']).toBeUndefined();
      expect(wrapper.vm.textureGroups.length).toBe(0);
    });

    it('should deselect group when selecting it again', async () => {
      const wrapper = createWrapper();

      const file = new File(['texture'], 'grass.png', { type: 'image/png' });
      const event = { target: { files: [file], value: '' } } as unknown as Event;
      wrapper.vm.handleFileUpload(event);
      await wrapper.vm.$nextTick();

      const groupId = wrapper.vm.textureGroups[0].id;
      expect(wrapper.vm.selectedGroupId).toBe(groupId);

      // Toggle selection off
      wrapper.vm.selectGroup(groupId);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedGroupId).toBeNull();
    });
  });
});
