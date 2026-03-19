<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { usePanelsStore } from "@/stores/panels";
import { useViewPanelsStore } from "@/stores/viewPanels";
import { useCameraConfigStore } from "@/stores/cameraConfig";
import type { CameraSlot } from "@/stores/cameraConfig";
import {
  getTools,
  CameraPreset,
  cameraPresets,
  setCameraPreset,
} from "@webgamekit/threejs";
import type { CoordinateTuple } from "@webgamekit/threejs";
import { createTimelineManager } from "@webgamekit/animation";
import * as THREE from "three";
import { createReactiveConfig } from "@/stores/viewConfig";
import { useDebugSceneStore } from "@/stores/debugScene";
import { useElementPropertiesStore } from "@/stores/elementProperties";
import { storeToRefs } from "pinia";
import { useSceneConfig } from "./useSceneConfig";
import { useTextureGroupsStore } from "@/stores/textureGroups";
import type { TextureGroup, GroupConfig } from "@/stores/textureGroups";
import { addGroupMeshes, removeGroupMeshes } from "@/utils/groupMeshes";
import { defaultConfig, presets, configControls, cameraSchema, groundSchema, lightsSchema, skySchema } from "./config";
import type { SceneEditorConfig } from "./config";
import { getNestedValue } from "@/utils/nestedObjects";

const canvas = ref<HTMLCanvasElement | null>(null);
const { openPanel } = usePanelsStore();
const { setViewPanels, clearViewPanels } = useViewPanelsStore();
const { setSceneElements, clearSceneElements } = useDebugSceneStore();
const cameraConfigStore = useCameraConfigStore();
const { cameraSlots, activeSlot } = storeToRefs(cameraConfigStore);
const { registerCameraHandlers, unregisterCameraHandlers, updateActiveSlotField, syncActiveSlotPosition, syncActiveSlotOrbitTarget } = cameraConfigStore;
const elementPropertiesStore = useElementPropertiesStore();
const { selectedElementName } = storeToRefs(elementPropertiesStore);
const { registerElementProperties, unregisterElementProperties, clearAllElementProperties, openElementProperties } = elementPropertiesStore;
const textureStore = useTextureGroupsStore();

// Derived refs from store for convenience
const textureGroups = computed({
  get: () => textureStore.groups,
  set: (value) => { textureStore.groups = value; },
});
const selectedGroupId = computed({
  get: () => textureStore.selectedGroupId,
  set: (value) => { textureStore.selectedGroupId = value; },
});
const autoUpdate = computed({
  get: () => textureStore.autoUpdate,
  set: (value) => { textureStore.autoUpdate = value; },
});

const hiddenElements = ref<Set<string>>(new Set());

// Update scene elements list for debugging
const updateSceneElements = (scene: THREE.Scene) => {
  const cameraElements = cameraSlots.value.map(slot => ({
    name: slot.label,
    type: 'Camera',
    hidden: false,
  }));
  setSceneElements(
    [
      ...cameraElements,
      ...scene.children.map((child: any) => {
        const groupId = textureGroups.value.find(g =>
          child.name?.startsWith(`grp-${g.id}-`) || child.name === `wireframe-${g.id}`
        )?.id;
        return {
          name: child.name || "(unnamed)",
          type: groupId ? 'TextureArea' : child.type,
          hidden: hiddenElements.value.has(child.name),
          groupId,
        };
      }),
    ],
    {
      onToggleVisibility: toggleElementVisibility,
      onRemove: removeSceneElement,
    },
    Object.fromEntries(textureGroups.value.map(g => [g.id, g.name]))
  );
};

// Toggle element visibility in scene
const toggleElementVisibility = (name: string) => {
  if (!currentScene) return;

  const element = currentScene.children.find((child: any) => child.name === name);
  if (element) {
    element.visible = !element.visible;

    if (element.visible) {
      hiddenElements.value.delete(name);
    } else {
      hiddenElements.value.add(name);
    }

    updateSceneElements(currentScene);
  }
};

// Remove element from scene
const removeSceneElement = (name: string) => {
  if (!currentScene) return;

  const element = currentScene.children.find((child: any) => child.name === name);
  if (element) {
    currentScene.remove(element);
    hiddenElements.value.delete(name);
    updateSceneElements(currentScene);
  }
};

const setNestedValue = (object: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.');
  const lastKey = keys[keys.length - 1];
  const target = keys.slice(0, -1).reduce((current: unknown, key) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string, unknown>)[key];
  }, object as unknown) as Record<string, unknown>;
  if (target) target[lastKey] = value;
};

// Guard flag to suppress auto-update during group config loading
let isLoadingGroupConfig = false;

// Create reactive configuration
const reactiveConfig = createReactiveConfig<SceneEditorConfig>(defaultConfig);

// Resolve group ID to group name for registry key
const getGroupName = (groupId: string) => {
  const group = textureGroups.value.find((g) => g.id === groupId);
  return group?.name ?? groupId;
};

// Snapshot current reactiveConfig into a GroupConfig
const snapshotGroupConfig = (): GroupConfig => ({
  area: {
    center: [...reactiveConfig.value.area.center] as CoordinateTuple,
    size: [...reactiveConfig.value.area.size] as CoordinateTuple,
  },
  textures: {
    baseSize: [...reactiveConfig.value.textures.baseSize] as CoordinateTuple,
    sizeVariation: [...reactiveConfig.value.textures.sizeVariation] as CoordinateTuple,
    rotationVariation: [
      ...reactiveConfig.value.textures.rotationVariation,
    ] as CoordinateTuple,
  },
  instances: { ...reactiveConfig.value.instances },
});

// Load a GroupConfig into reactiveConfig (suppresses auto-update watcher)
const loadGroupConfig = (groupConfig: GroupConfig) => {
  isLoadingGroupConfig = true;
  reactiveConfig.value.area.center = [...groupConfig.area.center] as CoordinateTuple;
  reactiveConfig.value.area.size = [...groupConfig.area.size] as CoordinateTuple;
  reactiveConfig.value.textures.baseSize = [
    ...groupConfig.textures.baseSize,
  ] as CoordinateTuple;
  reactiveConfig.value.textures.sizeVariation = [
    ...groupConfig.textures.sizeVariation,
  ] as CoordinateTuple;
  reactiveConfig.value.textures.rotationVariation = [
    ...groupConfig.textures.rotationVariation,
  ] as CoordinateTuple;
  reactiveConfig.value.instances.density = groupConfig.instances.density;
  reactiveConfig.value.instances.pattern = groupConfig.instances.pattern;
  reactiveConfig.value.instances.seed = groupConfig.instances.seed;
  nextTick(() => {
    isLoadingGroupConfig = false;
  });
};

// Watch selected group and load its config into reactiveConfig
watch(selectedGroupId, (groupId, oldGroupId) => {
  // Save current config back to the previous group
  if (oldGroupId) {
    const oldName = getGroupName(oldGroupId);
    textureStore.groupConfigRegistry[oldName] = snapshotGroupConfig();
  }

  if (groupId) {
    const name = getGroupName(groupId);

    // Initialize config for this group if it doesn't exist
    if (!textureStore.groupConfigRegistry[name]) {
      textureStore.groupConfigRegistry[name] = textureStore.createDefaultGroupConfig();
    }

    // Load group config into reactiveConfig
    loadGroupConfig(textureStore.groupConfigRegistry[name]);
  }
});

// Sync selectedGroupId when a group element is selected in ElementsPanel
watch(selectedElementName, (name) => {
  const group = textureGroups.value.find(g => g.id === name);
  if (group) {
    selectedGroupId.value = group.id;
  }
});

// Watch for preset changes and apply them
watch(
  () => reactiveConfig.value.preset,
  (newPreset) => {
    if (newPreset && presets[newPreset as keyof typeof presets]) {
      applyPreset(newPreset as keyof typeof presets);
    }
  }
);

// Watch for main config changes (area, textures, instances) to regenerate selected group
watch(
  () => ({
    area: reactiveConfig.value.area,
    textures: reactiveConfig.value.textures,
    instances: reactiveConfig.value.instances,
  }),
  () => {
    if (autoUpdate.value && !isLoadingGroupConfig && selectedGroupId.value) {
      // Save updated config to registry before regenerating
      const name = getGroupName(selectedGroupId.value);
      textureStore.groupConfigRegistry[name] = snapshotGroupConfig();
      regenerateGroupMeshes(selectedGroupId.value);
    }
  },
  { deep: true }
);

// Scene element configs via reactive composable
const { groundConfig, lightsConfig, skyConfig, registerSceneHandlers, unregisterSceneHandlers, updateGroundField, updateLightsField, updateSkyField } = useSceneConfig();

const animationId = 0;
let orbitControls: any = null;
let isApplyingUpdate = false;
let currentScene: any = null;
let currentCamera: any = null;
let currentWorld: any = null;
let currentGround: any = null;
let currentAmbientLight: THREE.Light | null = null;
let currentDirectionalLight: THREE.Light | null = null;
// Live-update ground properties without reinit
const applyGroundUpdate = (field: string, value: unknown) => {
  if (field === 'enabled' || field === 'size') {
    reinitScene();
    return;
  }
  if (field === 'color' && currentGround?.mesh?.material) {
    (currentGround.mesh.material as THREE.MeshStandardMaterial).color = new THREE.Color(value as number);
  }
};

// Live-update lights without reinit
const applyLightsUpdate = (path: string, value: unknown) => {
  const parts = path.split('.');
  const group = parts[0];
  const field = parts[1];
  if (group === 'ambient') {
    if (!currentAmbientLight) return;
    const light = currentAmbientLight as THREE.Light;
    if (field === 'intensity') light.intensity = value as number;
    else if (field === 'color') light.color.set(value as number);
  } else if (group === 'directional') {
    if (!currentDirectionalLight) return;
    const light = currentDirectionalLight as THREE.Light;
    if (field === 'intensity') light.intensity = value as number;
    else if (field === 'color') light.color.set(value as number);
    else if (field === 'position') light.position.set(...(value as [number, number, number]));
  }
};

// Live-update sky without reinit
const applySkyUpdate = (field: string, value: unknown) => {
  if (field === 'enabled' || field === 'size') {
    reinitScene();
    return;
  }
  if (field === 'color') {
    const skyMesh = currentScene?.getObjectByName('sky') as THREE.Mesh | undefined;
    if (skyMesh?.material) {
      (skyMesh.material as THREE.MeshBasicMaterial).color = new THREE.Color(value as number);
    }
    if (currentScene) {
      currentScene.background = new THREE.Color(value as number);
    }
  }
};

onMounted(() => {
  setViewPanels({});

  textureStore.registerHandlers({
    onSelectGroup: selectGroup,
    onRemoveGroup: removeGroup,
    onRemoveTexture: removeTextureFromGroup,
    onToggleVisibility: toggleGroupVisibility,
    onToggleWireframe: toggleGroupWireframe,
    onAddTextureToGroup: handleAddTextureToGroup,
    onAddNewGroup: handleFileUpload,
    onManualUpdate: () => { if (selectedGroupId.value) regenerateGroupMeshes(selectedGroupId.value); },
    onAddElement: () => {},
  });

  if (canvas.value) {
    initScene();
  }

  openPanel("elements");
});

onBeforeUnmount(() => {
  clearViewPanels();
  clearSceneElements();
  unregisterCameraHandlers();
  unregisterSceneHandlers();
  clearAllElementProperties();
  textureStore.clear();
});

// Register element properties for a texture group
const registerGroupElementProperties = (group: TextureGroup) => {
  registerElementProperties(group.id, {
    title: group.name,
    type: 'group',
    schema: configControls,
    getValue: (path) => getNestedValue(reactiveConfig.value as unknown as Record<string, unknown>, path),
    updateValue: (path, value) => {
      setNestedValue(reactiveConfig.value as unknown as Record<string, unknown>, path, value);
      if (autoUpdate.value && !isLoadingGroupConfig) {
        const name = getGroupName(group.id);
        textureStore.groupConfigRegistry[name] = snapshotGroupConfig();
        regenerateGroupMeshes(group.id);
      }
    },
  });
};

// Handle file upload - creates a new group with the uploaded texture
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const filename = file.name.replace(/\.[^./]+$/, ""); // Remove extension
    const textureId = `texture-${Date.now()}`;
    const groupId = `group-${Date.now()}`;

    const newGroup: TextureGroup = {
      id: groupId,
      name: filename,
      textures: [
        {
          id: textureId,
          name: filename,
          filename,
          url,
        },
      ],
    };

    textureGroups.value.push(newGroup);

    // Initialize config for this group by name if it doesn't exist
    if (!textureStore.groupConfigRegistry[filename]) {
      textureStore.groupConfigRegistry[filename] = textureStore.createDefaultGroupConfig();
    }

    // Register group element properties and open elements panel
    registerGroupElementProperties(newGroup);
    selectedGroupId.value = groupId;
    openElementProperties(groupId);
    openPanel("elements");

    // Wait for watcher to process selection, then add only the new group
    nextTick(() => {
      if (currentScene && currentWorld) addGroupMeshes(currentScene, currentWorld, newGroup, getGroupConfig, () => updateSceneElements(currentScene));
    });

    // Reset file input to allow re-uploading the same file
    target.value = "";
  }
};

// Handle adding a texture to an existing group
const handleAddTextureToGroup = (groupId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const filename = file.name.replace(/\.[^./]+$/, "");
    const textureId = `texture-${Date.now()}`;

    const group = textureGroups.value.find((g) => g.id === groupId);
    if (group) {
      group.textures.push({
        id: textureId,
        name: filename,
        filename,
        url,
      });

      regenerateGroupMeshes(groupId);
    }

    // Reset file input to allow re-uploading the same file
    target.value = "";
  }
};

// Select group
const selectGroup = (id: string) => {
  selectedGroupId.value = selectedGroupId.value === id ? null : id;
  if (selectedGroupId.value) {
    openElementProperties(selectedGroupId.value);
    openPanel("elements");
  }
};

// Toggle group visibility
const toggleGroupVisibility = (id: string) => {
  const group = textureGroups.value.find((g) => g.id === id);
  if (group) {
    group.hidden = !group.hidden;
    regenerateGroupMeshes(id);
  }
};

// Toggle group wireframe
const toggleGroupWireframe = (id: string) => {
  const group = textureGroups.value.find((g) => g.id === id);
  if (group) {
    group.showWireframe = !group.showWireframe;
    regenerateGroupMeshes(id);
  }
};

// Remove an entire group
const removeGroup = (id: string) => {
  const group = textureGroups.value.find((g) => g.id === id);
  if (group) {
    textureStore.deleteGroupConfig(group.name);
    if (currentScene) removeGroupMeshes(currentScene, id);
    if (selectedGroupId.value === id) {
      selectedGroupId.value = null;
    }
    unregisterElementProperties(id);
  }
  textureGroups.value = textureGroups.value.filter((g) => g.id !== id);
  if (currentScene) updateSceneElements(currentScene);
};

// Remove a single texture from a group
const removeTextureFromGroup = (groupId: string, textureId: string) => {
  const group = textureGroups.value.find((g) => g.id === groupId);
  if (group) {
    group.textures = group.textures.filter((t) => t.id !== textureId);

    // If group becomes empty, remove the whole group
    if (group.textures.length === 0) {
      removeGroup(groupId);
      return;
    }

    regenerateGroupMeshes(groupId);
  }
};

// Get full config for a specific group (with fallback to default config)
const getGroupConfig = (groupId: string): GroupConfig => {
  // For the currently selected group, values live in reactiveConfig
  if (groupId === selectedGroupId.value) {
    return snapshotGroupConfig();
  }
  const name = getGroupName(groupId);
  return textureStore.groupConfigRegistry[name] ?? textureStore.createDefaultGroupConfig();
};


// Regenerate only a specific group's meshes in the scene
const regenerateGroupMeshes = (groupId: string) => {
  if (!currentScene) {
    reinitScene();
    return;
  }
  const group = textureGroups.value.find((g) => g.id === groupId);
  if (!group) return;

  removeGroupMeshes(currentScene, groupId);
  addGroupMeshes(currentScene, currentWorld, group, getGroupConfig, () => updateSceneElements(currentScene));
};

// Reinitialize scene
const reinitScene = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // Clean up orbit controls listener before reinitializing
  if (orbitControls) {
    orbitControls.dispose();
    orbitControls = null;
  }

  if (canvas.value) {
    initScene();
  }
};

// Initialize 3D scene
const initScene = async () => {
  if (!canvas.value) return;

  const { setup, animate, scene, world, camera } = await getTools({
    canvas: canvas.value,
  });

  // Store references for live updates
  currentScene = scene;
  currentCamera = camera;
  currentWorld = world;

  const initialSlot = cameraSlots.value[0];
  const initialPosition: CoordinateTuple = initialSlot?.position ?? [0, 50, 100];
  const initialFov = initialSlot?.fov ?? 60;

  const { orbit, ground } = await setup({
    config: {
      camera: {
        position: initialPosition,
        fov: initialFov,
      },
      orbit: {
        target: new THREE.Vector3(0, 0, 0),
      },
      lights: {
        ambient: {
          color: lightsConfig.value.ambient.color,
          intensity: lightsConfig.value.ambient.intensity,
        },
        directional: {
          color: lightsConfig.value.directional.color,
          intensity: lightsConfig.value.directional.intensity,
          position: lightsConfig.value.directional.position,
          castShadow: false,
        },
      },
      ground: groundConfig.value.enabled
        ? {
            size: groundConfig.value.size,
            color: groundConfig.value.color,
          }
        : false,
      sky: skyConfig.value.enabled
        ? {
            size: skyConfig.value.size,
            color: skyConfig.value.color,
          }
        : false,
    },
    defineSetup: () => {
      // Add meshes for all groups
      textureGroups.value.forEach((group) => addGroupMeshes(scene, world, group, getGroupConfig));

      // Update debugging area with scene elements
      updateSceneElements(scene);
    },
  });

  // Store ground reference and disable shadows
  currentGround = ground;
  if (ground?.mesh) {
    ground.mesh.receiveShadow = false;
    ground.mesh.castShadow = false;
  }

  if (orbit) {
    orbitControls = orbit;
    orbitControls.addEventListener('change', () => {
      if (isApplyingUpdate || !currentCamera) return;
      syncActiveSlotPosition([
        currentCamera.position.x,
        currentCamera.position.y,
        currentCamera.position.z,
      ] as CoordinateTuple);
      syncActiveSlotOrbitTarget([
        orbitControls.target.x,
        orbitControls.target.y,
        orbitControls.target.z,
      ] as CoordinateTuple);
    });
  }

  // Register camera handlers — views call this after scene init
  registerCameraHandlers(
    [{ id: 'cam-1', label: 'Camera 1', preset: CameraPreset.Perspective, position: [0, 50, 100], fov: 60, orbitTarget: [0, 0, 0] }],
    {
      onPresetChange: (_slotId, preset) => {
        if (!currentCamera) return;
        const nextType = cameraPresets[preset].type;
        const currentType = currentCamera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic';
        if (currentType !== nextType) {
          reinitScene();
        } else {
          setCameraPreset(currentCamera, preset, window.innerWidth / window.innerHeight);
        }
      },
      onSlotActivate: (slotId) => {
        const slot = cameraSlots.value.find(s => s.id === slotId);
        if (!slot || !currentCamera) return;
        setCameraPreset(currentCamera, slot.preset, window.innerWidth / window.innerHeight);
      },
      onCleanup: () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (orbitControls) {
          orbitControls.dispose();
          orbitControls = null;
        }
      },
      onUpdate: (slotId) => {
        const slot = cameraSlots.value.find(s => s.id === slotId);
        if (!slot || !currentCamera) return;
        isApplyingUpdate = true;
        currentCamera.position.set(...slot.position);
        if (currentCamera instanceof THREE.PerspectiveCamera) {
          currentCamera.fov = slot.fov;
          currentCamera.updateProjectionMatrix();
        }
        if (orbitControls) {
          orbitControls.target.set(...slot.orbitTarget);
          orbitControls.update();
        }
        isApplyingUpdate = false;
      },
    }
  );

  // Register camera element properties
  const cameraLabel = cameraSlots.value[0]?.label ?? 'Camera 1';
  registerElementProperties(cameraLabel, {
    title: 'Camera',
    type: 'camera',
    schema: cameraSchema,
    getValue: (path) => getNestedValue(activeSlot.value as unknown as Record<string, unknown>, path),
    updateValue: (path, value) => updateActiveSlotField(path as keyof CameraSlot, value),
  });

  // Find and store light references for live updates
  currentAmbientLight = scene.getObjectByName('ambient-light') as THREE.Light ?? null;
  currentDirectionalLight = scene.getObjectByName('directional-light') as THREE.Light ?? null;

  // Register scene config handlers for live updates
  registerSceneHandlers({
    onGroundUpdate: applyGroundUpdate,
    onLightsUpdate: applyLightsUpdate,
    onSkyUpdate: applySkyUpdate,
    onCleanup: () => {},
  });

  // Register ground element properties if enabled
  if (groundConfig.value.enabled) {
    registerElementProperties('ground', {
      title: 'Ground',
      schema: groundSchema,
      getValue: (path) => getNestedValue(groundConfig.value as unknown as Record<string, unknown>, path),
      updateValue: (path, value) => updateGroundField(path as keyof typeof groundConfig.value, value),
    });
  }

  // Register sky element properties if enabled
  if (skyConfig.value.enabled) {
    registerElementProperties('sky', {
      title: 'Sky',
      schema: skySchema,
      getValue: (path) => getNestedValue(skyConfig.value as unknown as Record<string, unknown>, path),
      updateValue: (path, value) => updateSkyField(path as keyof typeof skyConfig.value, value),
    });
  }

  // Register lights element properties
  registerElementProperties('lights', {
    title: 'Lights',
    schema: lightsSchema,
    getValue: (path) => getNestedValue(lightsConfig.value as unknown as Record<string, unknown>, path),
    updateValue: (path, value) => updateLightsField(path, value),
  });

  // Create an empty timeline manager (no animations needed for static textures)
  const timelineManager = createTimelineManager();

  animate({
    timeline: timelineManager,
  });
};

// Apply preset configuration
const applyPreset = (presetName: keyof typeof presets) => {
  const preset = presets[presetName];
  if (preset) {
    Object.assign(reactiveConfig.value, preset.config);
    reinitScene();
  }
};

// Export configuration as JSON
const exportConfiguration = () => {
  const config = {
    area: reactiveConfig.value.area,
    textures: reactiveConfig.value.textures,
    instances: reactiveConfig.value.instances,
  };
  return config;
};

// Expose methods for testing
defineExpose({
  exportConfiguration,
  reactiveConfig,
  textureGroups,
  groupConfigRegistry: textureStore.groupConfigRegistry,
  selectedGroupId,
  handleFileUpload,
  handleAddTextureToGroup,
  selectGroup,
  removeGroup,
  removeTextureFromGroup,
});
</script>

<template>
  <div class="texture-editor">
    <canvas ref="canvas"></canvas>

  </div>
</template>

<style scoped>
.texture-editor {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
