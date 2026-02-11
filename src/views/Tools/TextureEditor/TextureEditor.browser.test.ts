import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { page } from 'vitest/browser';
import TextureEditor from './TextureEditor.vue';

describe('TextureEditor - Component Rendering', () => {
  it('should successfully mount and render 3D scene', async () => {
    // Create required dependencies
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{
        path: '/',
        name: 'TextureEditor',
        component: TextureEditor
      }]
    });

    const wrapper = mount(TextureEditor, {
      global: {
        plugins: [pinia, router]
      },
      attachTo: document.body
    });

    // Wait for component to mount
    await wrapper.vm.$nextTick();

    // Verify canvas element exists - this confirms Three.js initialization started
    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
    expect(canvas.element.tagName).toBe('CANVAS');

    // Wait for Three.js scene to initialize and render multiple frames
    // WebGL needs time to compile shaders, load models, and render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for animation frames to ensure rendering happened
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    }));

    // Take screenshot for visual verification
    const screenshot = await page.screenshot();
    expect(screenshot).toBeDefined();

    // Verify the canvas has actual dimensions (not 0x0)
    const canvasElement = canvas.element as HTMLCanvasElement;
    expect(canvasElement.width).toBeGreaterThan(0);
    expect(canvasElement.height).toBeGreaterThan(0);

    // Verify upload overlay exists (since no textures are uploaded)
    const uploadOverlay = wrapper.find('.texture-editor__upload-overlay');
    expect(uploadOverlay.exists()).toBe(true);

    // Verify file input exists
    const fileInput = wrapper.find('input[type="file"]');
    expect(fileInput.exists()).toBe(true);

    // Verify action buttons exist
    const actions = wrapper.find('.texture-editor__actions');
    expect(actions.exists()).toBe(true);

    // Verify preset buttons exist
    const presetClouds = wrapper.find('[data-testid="preset-clouds"]');
    const presetDecals = wrapper.find('[data-testid="preset-decals"]');
    const presetGrass = wrapper.find('[data-testid="preset-grass"]');
    expect(presetClouds.exists()).toBe(true);
    expect(presetDecals.exists()).toBe(true);
    expect(presetGrass.exists()).toBe(true);

    // Cleanup
    wrapper.unmount();
  }, 10_000); // Increase timeout to 10 seconds
});
