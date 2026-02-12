import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import TextureEditor from './TextureEditor.vue';
import type { CoordinateTuple } from '@webgamekit/threejs';

//Mock threejs functions
vi.mock('@webgamekit/threejs', async () => {
  const actual = await vi.importActual<typeof import('@webgamekit/threejs')>('@webgamekit/threejs');
  return {
    ...actual,
    getTools: vi.fn(() => Promise.resolve({
      setup: vi.fn((config) => Promise.resolve()),
      animate: vi.fn(),
      scene: {},
      world: {},
    })),
    getCube: vi.fn(),
    generateAreaPositions: vi.fn(() => [[0, 0, 0] as CoordinateTuple]),
  };
});

describe('TextureEditor', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{
        path: '/tools/texture-editor',
        name: 'TextureEditor',
        component: TextureEditor,
      }],
    });
  });

  const createWrapper = () => {
    return mount(TextureEditor, {
      global: {
        plugins: [pinia, router],
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
    it('should have file input for texture upload', () => {
      const wrapper = createWrapper();
      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.exists()).toBe(true);
      expect(fileInput.attributes('accept')).toContain('image');
    });

    it('should handle single texture file upload', async () => {
      const wrapper = createWrapper();
      const fileInput = wrapper.find('input[type="file"]');

      const file = new File(['texture'], 'test.png', { type: 'image/png' });
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false,
      });

      await fileInput.trigger('change');
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureItems).toBeDefined();
      expect(wrapper.vm.textureItems.length).toBeGreaterThan(0);
      expect(wrapper.vm.textureItems[0]).toHaveProperty('name');
      expect(wrapper.vm.textureItems[0]).toHaveProperty('url');
      expect(wrapper.vm.textureItems[0]).toHaveProperty('id');
    });

    it('should handle adding texture items with names', async () => {
      const wrapper = createWrapper();
      const fileInput = wrapper.find('input[type="file"]');

      // Add first texture
      const file1 = new File(['texture1'], 'grass.png', { type: 'image/png' });
      Object.defineProperty(fileInput.element, 'files', {
        value: [file1],
        writable: false,
      });

      await fileInput.trigger('change');
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.textureItems.length).toBe(1);
      expect(wrapper.vm.textureItems[0].name).toBe('grass');
    });
  });

  describe('Configuration Export', () => {
    it('should export configuration as JSON', () => {
      const wrapper = createWrapper();

      const exportButton = wrapper.find('[data-testid="export-config"]');
      expect(exportButton.exists()).toBe(true);

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

    it('should copy configuration to clipboard', async () => {
      const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: clipboardWriteText }
      });

      const wrapper = createWrapper();
      const copyButton = wrapper.find('[data-testid="copy-config"]');

      await copyButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(clipboardWriteText).toHaveBeenCalled();
    });
  });

  describe('Area Position Configuration', () => {
    it('should support pattern selection', () => {
      const wrapper = createWrapper();

      const patternSelect = wrapper.find('[data-testid="pattern-select"]');
      expect(patternSelect.exists()).toBe(true);
    });

    it.each([
      ['random', 'random'],
      ['grid', 'grid'],
      ['grid-jitter', 'grid-jitter']
    ])('should support %s pattern', async (patternName, patternValue) => {
      const wrapper = createWrapper();
      const patternSelect = wrapper.find('[data-testid="pattern-select"]');

      await patternSelect.setValue(patternValue);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.reactiveConfig.instances.pattern).toBe(patternValue);
    });

    it('should allow seed configuration', () => {
      const wrapper = createWrapper();
      const seedInput = wrapper.find('[data-testid="seed-input"]');

      expect(seedInput.exists()).toBe(true);
      expect(seedInput.attributes('type')).toBe('number');
    });

    it('should allow instance count configuration', () => {
      const wrapper = createWrapper();
      const countInput = wrapper.find('[data-testid="instance-count"]');

      expect(countInput.exists()).toBe(true);
      expect(countInput.attributes('type')).toBe('number');
    });
  });

  describe('Size and Rotation Variations', () => {
    it('should have size variation controls for X, Y, Z', () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="size-variation-x"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="size-variation-y"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="size-variation-z"]').exists()).toBe(true);
    });

    it('should have rotation variation controls for X, Y, Z', () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="rotation-variation-x"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="rotation-variation-y"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="rotation-variation-z"]').exists()).toBe(true);
    });
  });

  describe('Preset Values', () => {
    it('should have preset button for billboard clouds', () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-clouds"]');

      expect(presetButton.exists()).toBe(true);
    });

    it('should apply billboard clouds preset', async () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-clouds"]');

      await presetButton.trigger('click');
      await wrapper.vm.$nextTick();

      const config = wrapper.vm.reactiveConfig;
      expect(config.textures.baseSize).toEqual([200, 100, 0]);
      expect(config.textures.sizeVariation).toEqual([100, 50, 0]);
    });

    it('should have preset button for scattered decals', () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-decals"]');

      expect(presetButton.exists()).toBe(true);
    });

    it('should apply scattered decals preset', async () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-decals"]');

      await presetButton.trigger('click');
      await wrapper.vm.$nextTick();

      const config = wrapper.vm.reactiveConfig;
      expect(config.textures.baseSize).toEqual([10, 7, 0]);
      expect(config.textures.sizeVariation).toEqual([5, 3, 0]);
    });

    it('should have preset button for dense grass', () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-grass"]');

      expect(presetButton.exists()).toBe(true);
    });

    it('should apply dense grass preset', async () => {
      const wrapper = createWrapper();
      const presetButton = wrapper.find('[data-testid="preset-grass"]');

      await presetButton.trigger('click');
      await wrapper.vm.$nextTick();

      const config = wrapper.vm.reactiveConfig;
      expect(config.textures.baseSize).toEqual([10, 17, 0]);
      expect(config.instances.count).toBe(500);
    });
  });
});
