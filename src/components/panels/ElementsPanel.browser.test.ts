import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { nextTick, defineComponent, h, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import ElementsPanel from './ElementsPanel.vue';
import { useDebugSceneStore } from '@/stores/debugScene';
import { storeToRefs } from 'pinia';
import { useElementPropertiesStore } from '@/stores/elementProperties';

const EXPECTED_ELEMENT_NAMES = [
  'Camera',
  'ambient-light',
  'directional-light',
  'ground',
  'sky',
  'TestCube',
] as const;

type ExpectedElementName = (typeof EXPECTED_ELEMENT_NAMES)[number];

// Simulates a view that initializes a Three.js scene and registers its elements,
// matching the pattern used by real views (GoombaRunner, SceneEditor, etc.)
const FauxPage = defineComponent({
  name: 'FauxPage',
  setup() {
    const { registerSceneElements, clearSceneElements } = useDebugSceneStore();
    const { registerElementProperties, clearAllElementProperties } = useElementPropertiesStore();

    onMounted(() => {
      const scene = new THREE.Scene();

      const ambientLight = new THREE.AmbientLight(0xffffff, 2);
      ambientLight.name = 'ambient-light';
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
      directionalLight.name = 'directional-light';
      scene.add(directionalLight);

      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.01, 1000), groundMaterial);
      groundMesh.name = 'ground';
      scene.add(groundMesh);

      const skyMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaff });
      const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1000), skyMaterial);
      skyMesh.name = 'sky';
      scene.add(skyMesh);

      const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), cubeMaterial);
      cube.name = 'TestCube';
      scene.add(cube);

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

      registerSceneElements(camera, [...scene.children]);

      registerElementProperties('Camera', {
        title: 'Camera',
        type: 'camera',
        schema: {
          fov: { min: 10, max: 170, step: 1, label: 'FOV' },
        },
        getValue: (path) => path === 'fov' ? camera.fov : undefined,
        updateValue: (path, value) => { if (path === 'fov') camera.fov = value as number; },
      });

      registerElementProperties('ambient-light', {
        title: 'Ambient Light',
        schema: {
          intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' },
        },
        getValue: (path) => path === 'intensity' ? ambientLight.intensity : undefined,
        updateValue: (path, value) => { if (path === 'intensity') ambientLight.intensity = value as number; },
      });

      registerElementProperties('directional-light', {
        title: 'Directional Light',
        schema: {
          intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' },
        },
        getValue: (path) => path === 'intensity' ? directionalLight.intensity : undefined,
        updateValue: (path, value) => { if (path === 'intensity') directionalLight.intensity = value as number; },
      });

      registerElementProperties('ground', {
        title: 'Ground',
        schema: {
          color: { color: true, label: 'Color' },
        },
        getValue: (path) => path === 'color' ? `#${groundMaterial.color.getHexString()}` : undefined,
        updateValue: (path, value) => { if (path === 'color') groundMaterial.color.set(value as string); },
      });

      registerElementProperties('sky', {
        title: 'Sky',
        schema: {
          color: { color: true, label: 'Color' },
        },
        getValue: (path) => path === 'color' ? `#${skyMaterial.color.getHexString()}` : undefined,
        updateValue: (path, value) => { if (path === 'color') skyMaterial.color.set(value as string); },
      });

      registerElementProperties('TestCube', {
        title: 'TestCube',
        schema: {
          color: { color: true, label: 'Color' },
        },
        getValue: (path) => path === 'color' ? `#${cubeMaterial.color.getHexString()}` : undefined,
        updateValue: (path, value) => { if (path === 'color') cubeMaterial.color.set(value as string | number); },
      });
    });

    onUnmounted(() => {
      clearSceneElements();
      clearAllElementProperties();
    });

    return () => h('div');
  },
});

describe('ElementsPanel - E2E browser test', () => {
  let wrapper: VueWrapper;
  let leftPanelsContainer: HTMLDivElement;

  beforeEach(async () => {
    leftPanelsContainer = document.createElement('div');
    leftPanelsContainer.id = 'left-panels';
    document.body.appendChild(leftPanelsContainer);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    });

    await router.push('/?elements=true');
    await router.isReady();

    const TestWrapper = defineComponent({
      setup: () => () => h('div', [h(FauxPage), h(ElementsPanel)]),
    });

    wrapper = mount(TestWrapper, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    });

    await nextTick();
    await new Promise<void>(r => setTimeout(r, 100));
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.removeChild(leftPanelsContainer);
  });

  it('shows all expected scene elements when panel is open', () => {
    const panelContent = document.querySelector('#left-panels .sheet-content');
    expect(panelContent).not.toBeNull();

    const text = panelContent!.textContent ?? '';
    EXPECTED_ELEMENT_NAMES.forEach((name: ExpectedElementName) => {
      expect(text).toContain(name);
    });
  });

  it.each(
    EXPECTED_ELEMENT_NAMES.map(name => [name] as [ExpectedElementName])
  )('clicking "%s" expands its properties section', async (elementName) => {
    const panelContent = document.querySelector('#left-panels .sheet-content');
    expect(panelContent).not.toBeNull();

    const headers = [...panelContent!.querySelectorAll('.elements-panel__item-header')];
    const header = headers.find(h => h.textContent?.includes(elementName));
    expect(header).toBeDefined();

    (header as HTMLElement).click();
    await nextTick();
    await new Promise<void>(r => setTimeout(r, 50));

    const expandedContent = panelContent!.querySelector('.elements-panel__item-content');
    expect(expandedContent).not.toBeNull();
  });

  it('updating TestCube color property reflects in the Three.js mesh material', () => {
    const store = useElementPropertiesStore();
    const { activeProperties } = storeToRefs(store);

    store.openElementProperties('TestCube');
    expect(activeProperties.value).not.toBeNull();
    expect(activeProperties.value?.schema).toHaveProperty('color');

    expect(activeProperties.value!.getValue('color')).toBe('#222222');

    activeProperties.value!.updateValue('color', '#ff0000');

    expect(activeProperties.value!.getValue('color')).toBe('#ff0000');
  });
});
