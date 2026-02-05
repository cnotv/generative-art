import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { nextTick, defineComponent, h } from 'vue';
import ToolsPanel from './ToolsPanel.vue';
import { resetPanelState } from '@/composables/usePanels';

// Minimal view component for testing
const TestView = defineComponent({
  name: 'TestView',
  setup() {
    return () => h('div', { class: 'test-view' }, 'Test View');
  },
});

describe('ToolsPanel - Sidebar Open/Close', () => {
  let wrapper: VueWrapper;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    // Reset module-level panel state before each test
    resetPanelState();

    const pinia = createPinia();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: TestView,
        },
        {
          path: '/test',
          component: TestView,
        },
      ],
    });

    await router.push('/');
    await router.isReady();

    wrapper = mount(ToolsPanel, {
      global: {
        plugins: [pinia, router],
      },
      attachTo: document.body,
    });

    await nextTick();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('should open sidebar and keep it open when clicking settings button', async () => {
    // Find the settings button
    const settingsButton = wrapper.find('button');
    expect(settingsButton.exists()).toBe(true);

    // Click to open sidebar
    await settingsButton.trigger('click');
    await nextTick();

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the sheet content is visible (sidebar is open)
    const sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).not.toBeNull();

    // Verify URL has config=true query param
    expect(router.currentRoute.value.query.config).toBe('true');
  });

  it('should close sidebar when clicking X close button', async () => {
    // Open the sidebar first
    const settingsButton = wrapper.find('button');
    await settingsButton.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify sidebar is open
    let sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).not.toBeNull();
    expect(router.currentRoute.value.query.config).toBe('true');

    // Find and click the close button
    const closeButton = document.querySelector('.sheet-close');
    expect(closeButton).not.toBeNull();
    (closeButton as HTMLElement).click();

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify sidebar is closed
    sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).toBeNull();

    // Verify URL query param is removed
    expect(router.currentRoute.value.query.config).toBeUndefined();
  });

  it('should close sidebar when clicking overlay', async () => {
    // Open the sidebar first
    const settingsButton = wrapper.find('button');
    await settingsButton.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify sidebar is open
    let sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).not.toBeNull();

    // Find and click the overlay
    const overlay = document.querySelector('.sheet-overlay');
    expect(overlay).not.toBeNull();
    (overlay as HTMLElement).click();

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify sidebar is closed
    sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).toBeNull();

    // Verify URL query param is removed
    expect(router.currentRoute.value.query.config).toBeUndefined();
  });

  it('should NOT immediately close after opening (regression test)', async () => {
    // This test specifically catches the bug where @interact-outside fires
    // on the same click that opens the dialog

    const settingsButton = wrapper.find('button');

    // Click to open
    await settingsButton.trigger('click');

    // Wait a bit for any async operations
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The sidebar MUST still be open after waiting
    const sheetContent = document.querySelector('.sheet-content');
    expect(sheetContent).not.toBeNull();
    expect(router.currentRoute.value.query.config).toBe('true');
  });
});
