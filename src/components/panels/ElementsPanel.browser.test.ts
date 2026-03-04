import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { nextTick, defineComponent, h, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import ElementsPanel from './ElementsPanel.vue';
import { useDebugSceneStore } from '@/stores/debugScene';
import { storeToRefs } from 'pinia';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { useTextureGroupsStore } from '@/stores/textureGroups';
import { usePanelsStore } from '@/stores/panels';

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

const getSheetContent = () => document.body.querySelector('.sheet-content');

// Shared setup helpers
const buildRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  await router.push('/');
  await router.isReady();
  return router;
};

const openElementsPanel = () => {
  const panelsStore = usePanelsStore();
  panelsStore.activePanels = new Set(['elements']);
};

describe('ElementsPanel - E2E browser test', () => {
  let wrapper: VueWrapper;
  let leftPanelsContainer: HTMLDivElement;

  beforeEach(async () => {
    leftPanelsContainer = document.createElement('div');
    leftPanelsContainer.id = 'left-panels';
    document.body.appendChild(leftPanelsContainer);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = await buildRouter();

    const TestWrapper = defineComponent({
      setup: () => () => h('div', [h(FauxPage), h(ElementsPanel)]),
    });

    wrapper = mount(TestWrapper, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    });

    openElementsPanel();
    await nextTick();
    await new Promise<void>(r => setTimeout(r, 100));
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.removeChild(leftPanelsContainer);
  });

  it('shows all expected scene elements when panel is open', () => {
    const panelContent = getSheetContent();
    expect(panelContent).not.toBeNull();

    const text = panelContent!.textContent ?? '';
    EXPECTED_ELEMENT_NAMES.forEach((name: ExpectedElementName) => {
      expect(text).toContain(name);
    });
  });

  it.each(
    EXPECTED_ELEMENT_NAMES.map(name => [name] as [ExpectedElementName])
  )('clicking "%s" expands its properties section', async (elementName) => {
    const panelContent = getSheetContent();
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

// Shared setup for reactivity tests (no FauxPage — stores start empty)
const setupEmptyPanel = async () => {
  const leftPanelsContainer = document.createElement('div');
  leftPanelsContainer.id = 'left-panels';
  document.body.appendChild(leftPanelsContainer);

  const pinia = createPinia();
  setActivePinia(pinia);

  const router = await buildRouter();

  const wrapper = mount(ElementsPanel, {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  });

  openElementsPanel();
  await nextTick();
  await new Promise<void>(r => setTimeout(r, 100));

  return { wrapper, leftPanelsContainer };
};

describe('ElementsPanel - scene elements reactivity', () => {
  let wrapper: VueWrapper;
  let leftPanelsContainer: HTMLDivElement;

  beforeEach(async () => {
    ({ wrapper, leftPanelsContainer } = await setupEmptyPanel());
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.removeChild(leftPanelsContainer);
  });

  it('shows "No scene elements" when stores are empty', () => {
    const panelContent = getSheetContent();
    expect(panelContent).not.toBeNull();
    expect(panelContent!.textContent).toContain('No scene elements');
  });

  it('panel updates reactively when sceneElements are added', async () => {
    const debugStore = useDebugSceneStore();
    const panelContent = getSheetContent();

    expect(panelContent!.textContent).toContain('No scene elements');

    debugStore.registerSceneElements(
      { type: 'PerspectiveCamera' },
      [{ name: 'ReactiveBox', type: 'Mesh' }]
    );
    await nextTick();

    expect(panelContent!.textContent).toContain('ReactiveBox');
    expect(panelContent!.textContent).not.toContain('No scene elements');
  });

  it('panel removes element from list when clearSceneElements is called', async () => {
    const debugStore = useDebugSceneStore();
    const panelContent = getSheetContent();

    debugStore.registerSceneElements(
      { type: 'PerspectiveCamera' },
      [{ name: 'TemporaryMesh', type: 'Mesh' }]
    );
    await nextTick();
    expect(panelContent!.textContent).toContain('TemporaryMesh');

    debugStore.clearSceneElements();
    await nextTick();

    expect(panelContent!.textContent).toContain('No scene elements');
  });

  it('shows texture group header when elements with groupId are registered', async () => {
    const debugStore = useDebugSceneStore();
    const textureStore = useTextureGroupsStore();
    const panelContent = getSheetContent();

    textureStore.groups = [{ id: 'group-abc', name: 'My Texture Group', textures: [] }];
    debugStore.setSceneElements(
      [{ name: 'cube-1', type: 'Mesh', groupId: 'group-abc', hidden: false }],
      { onToggleVisibility: vi.fn(), onRemove: vi.fn() },
      { 'group-abc': 'My Texture Group' }
    );
    await nextTick();

    expect(panelContent!.textContent).toContain('My Texture Group');
  });

  it('texture group disappears from panel when cleared from store', async () => {
    const debugStore = useDebugSceneStore();
    const textureStore = useTextureGroupsStore();
    const panelContent = getSheetContent();

    textureStore.groups = [{ id: 'group-xyz', name: 'Removable Group', textures: [] }];
    debugStore.setSceneElements(
      [{ name: 'mesh-1', type: 'Mesh', groupId: 'group-xyz', hidden: false }],
      { onToggleVisibility: vi.fn(), onRemove: vi.fn() },
      { 'group-xyz': 'Removable Group' }
    );
    await nextTick();
    expect(panelContent!.textContent).toContain('Removable Group');

    textureStore.groups = [];
    debugStore.clearSceneElements();
    await nextTick();

    expect(panelContent!.textContent).toContain('No scene elements');
  });
});

describe('ElementsPanel - texture upload handler', () => {
  let wrapper: VueWrapper;
  let leftPanelsContainer: HTMLDivElement;

  beforeEach(async () => {
    ({ wrapper, leftPanelsContainer } = await setupEmptyPanel());
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.removeChild(leftPanelsContainer);
    vi.restoreAllMocks();
  });

  it('clicking Add Texture Area button creates a file input and clicks it', async () => {
    const mockInput = {
      type: '',
      accept: '',
      onchange: null as ((e: Event) => void) | null,
      click: vi.fn(),
    };
    const spy = vi.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput as unknown as HTMLElement);

    const panelContent = getSheetContent();
    const textureButton = [...(panelContent?.querySelectorAll('button') ?? [])]
      .find(b => b.getAttribute('title') === 'Add Texture Area');
    expect(textureButton).toBeDefined();

    textureButton!.click();
    await nextTick();

    expect(spy).toHaveBeenCalledWith('input');
    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('image/*');
    expect(mockInput.click).toHaveBeenCalled();
  });

  it('clicking Add Texture Area and selecting a file calls onAddNewGroup handler', async () => {
    const textureStore = useTextureGroupsStore();
    const mockOnAddNewGroup = vi.fn();
    textureStore.registerHandlers({
      onAddNewGroup: mockOnAddNewGroup,
      onAddElement: vi.fn(),
      onSelectGroup: vi.fn(),
      onRemoveGroup: vi.fn(),
      onRemoveTexture: vi.fn(),
      onToggleVisibility: vi.fn(),
      onToggleWireframe: vi.fn(),
      onAddTextureToGroup: vi.fn(),
      onManualUpdate: vi.fn(),
    });

    let capturedOnChange: ((e: Event) => void) | null = null;
    const mockInput = {
      type: '',
      accept: '',
      set onchange(handler: (e: Event) => void) { capturedOnChange = handler; },
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput as unknown as HTMLElement);

    const panelContent = getSheetContent();
    const textureButton = [...(panelContent?.querySelectorAll('button') ?? [])]
      .find(b => b.getAttribute('title') === 'Add Texture Area');
    textureButton!.click();
    await nextTick();

    expect(capturedOnChange).not.toBeNull();
    capturedOnChange!(new Event('change'));

    expect(mockOnAddNewGroup).toHaveBeenCalledOnce();
  });
});
