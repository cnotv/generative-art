<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import { usePanels } from "@/composables/usePanels";
import { useViewPanels } from "@/composables/useViewPanels";
import { getTools, getCube, generateAreaPositions } from "@webgamekit/threejs";
import type { CoordinateTuple, AreaConfig } from "@webgamekit/threejs";
import { createTimelineManager } from "@webgamekit/animation";
import * as THREE from "three";
import { TexturesPanel } from "@/components/panels";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/composables/useViewConfig";
import { useDebugScene } from "@/composables/useDebugScene";
import { defaultConfig, presets, configControls, sceneControls } from "./config";
import type { SceneEditorConfig } from "./config";

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const { openPanel } = usePanels();
const { setViewPanels, clearViewPanels } = useViewPanels();
const { setSceneElements, clearSceneElements } = useDebugScene();

// Texture item within a group
interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

// Group of textures that share config and area
interface TextureGroup {
  id: string;
  name: string;
  textures: TextureItem[];
  hidden?: boolean;
  showWireframe?: boolean;
}

const textureGroups = ref<TextureGroup[]>([]);
const selectedGroupId = ref<string | null>(null);

// Auto-update toggle
const autoUpdate = ref(true);

const hiddenElements = ref<Set<string>>(new Set());

// Update scene elements list for debugging
const updateSceneElements = (scene: THREE.Scene) => {
  setSceneElements(
    scene.children.map((child: any) => ({
      name: child.name || "(unnamed)",
      type: child.type,
      hidden: hiddenElements.value.has(child.name),
    })),
    {
      onToggleVisibility: toggleElementVisibility,
      onRemove: removeSceneElement,
    }
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

// Guard flag to suppress auto-update during group config loading
let isLoadingGroupConfig = false;

// Per-group config stored by group name
interface GroupConfig {
  area: {
    center: CoordinateTuple;
    size: CoordinateTuple;
  };
  textures: {
    baseSize: CoordinateTuple;
    sizeVariation: CoordinateTuple;
    rotationVariation: CoordinateTuple;
  };
  instances: {
    density: number;
    pattern: "random" | "grid" | "grid-jitter";
    seed: number;
  };
}

const groupConfigRegistry = ref<Record<string, GroupConfig>>({});

// Create reactive configuration
const reactiveConfig = createReactiveConfig<SceneEditorConfig>(defaultConfig);

// Resolve group ID to group name for registry key
const getGroupName = (groupId: string) => {
  const group = textureGroups.value.find((g) => g.id === groupId);
  return group?.name ?? groupId;
};

// Create a new GroupConfig from default values
const createDefaultGroupConfig = (): GroupConfig => ({
  area: {
    center: [...defaultConfig.area.center] as CoordinateTuple,
    size: [...defaultConfig.area.size] as CoordinateTuple,
  },
  textures: {
    baseSize: [...defaultConfig.textures.baseSize] as CoordinateTuple,
    sizeVariation: [...defaultConfig.textures.sizeVariation] as CoordinateTuple,
    rotationVariation: [...defaultConfig.textures.rotationVariation] as CoordinateTuple,
  },
  instances: { ...defaultConfig.instances },
});

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
    groupConfigRegistry.value[oldName] = snapshotGroupConfig();
  }

  if (groupId) {
    const name = getGroupName(groupId);

    // Initialize config for this group if it doesn't exist
    if (!groupConfigRegistry.value[name]) {
      groupConfigRegistry.value[name] = createDefaultGroupConfig();
    }

    // Load group config into reactiveConfig
    loadGroupConfig(groupConfigRegistry.value[name]);
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
      groupConfigRegistry.value[name] = snapshotGroupConfig();
      regenerateGroupMeshes(selectedGroupId.value);
    }
  },
  { deep: true }
);

// Scene configuration
const sceneConfig = createReactiveConfig({
  camera: {
    position: [0, 50, 100] as CoordinateTuple,
    target: [0, 0, 0] as CoordinateTuple,
    fov: 60,
  },
  ground: {
    enabled: true,
    color: 0x98887d,
  },
  sky: {
    enabled: true,
    color: 0x87ceeb,
  },
});

let animationId = 0;
let orbitControls: any = null;
let currentScene: any = null;
let currentCamera: any = null;
let currentWorld: any = null;
let currentGround: any = null;
let previousGroundEnabled = false;
let previousSkyEnabled = false;

// Manual update trigger
const triggerManualUpdate = () => {
  reinitScene();
};

// Update only scene properties without regenerating textures
const updateSceneProperties = () => {
  // If ground/sky enabled state changed, reinit scene instead
  if (
    sceneConfig.value.ground.enabled !== previousGroundEnabled ||
    sceneConfig.value.sky.enabled !== previousSkyEnabled
  ) {
    previousGroundEnabled = sceneConfig.value.ground.enabled;
    previousSkyEnabled = sceneConfig.value.sky.enabled;
    reinitScene();
    return;
  }

  if (!currentScene || !currentCamera) return;

  // Update background color
  currentScene.background = sceneConfig.value.sky.enabled
    ? new THREE.Color(sceneConfig.value.sky.color)
    : new THREE.Color(0x000000);

  // Update ground color
  if (sceneConfig.value.ground.enabled && currentGround?.mesh?.material) {
    currentGround.mesh.material.color = new THREE.Color(sceneConfig.value.ground.color);
  }

  // Update camera properties
  currentCamera.position.set(...sceneConfig.value.camera.position);
  if (currentCamera.fov !== undefined) {
    currentCamera.fov = sceneConfig.value.camera.fov;
    currentCamera.updateProjectionMatrix();
  }

  // Update orbit target
  if (orbitControls) {
    orbitControls.target.set(...sceneConfig.value.camera.target);
    orbitControls.update();
  }
};

// Register configuration panel with onChange callback (auto-debounced)
onMounted(() => {
  // Set view-specific panels for GlobalNavigation
  setViewPanels({
    showTextures: true,
    showConfig: true,
    showScene: true,
  });

  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls,
    updateSceneProperties
  );

  if (canvas.value) {
    initScene();
  }

  // Open textures panel on page load
  openPanel("textures");
});

onBeforeUnmount(() => {
  // Clear view-specific panels
  clearViewPanels();

  // Clear debug scene elements
  clearSceneElements();

  // Unregister config
  unregisterViewConfig(route.name as string);

  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});

// Handle file upload - creates a new group with the uploaded texture
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
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
    if (!groupConfigRegistry.value[filename]) {
      groupConfigRegistry.value[filename] = createDefaultGroupConfig();
    }

    // Auto-select the newly added group (watcher will load its config)
    selectedGroupId.value = groupId;
    // Open config panel for the new group
    openPanel("config");

    // Wait for watcher to process selection, then add only the new group
    nextTick(() => addGroupMeshes(newGroup));

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
    const filename = file.name.replace(/\.[^/.]+$/, "");
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
  // Open config panel when selecting a group
  if (selectedGroupId.value) {
    openPanel("config");
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
    // Remove from group config registry by name
    delete groupConfigRegistry.value[group.name];
    removeGroupMeshes(id);
    if (selectedGroupId.value === id) {
      selectedGroupId.value = null;
    }
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
  return groupConfigRegistry.value[name] ?? createDefaultGroupConfig();
};

// Convert density to count. Density is used directly as the instance count.
// Density 0 = 1 position.
const MAX_INSTANCES = 2000;
const densityToCount = (density: number): number => {
  if (density <= 0) return 1;
  return Math.min(MAX_INSTANCES, Math.max(1, Math.round(density)));
};

// Create texture instances following ForestGame pattern - per group
const createTextureInstances = (groups: TextureGroup[]) => {
  const allVariantData: Array<{
    texture: string;
    filename: string;
    groupId: string;
    groupConfig: GroupConfig;
    positions: CoordinateTuple[];
    instances: Array<{
      position: CoordinateTuple;
      scale: CoordinateTuple;
      rotation: CoordinateTuple;
    }>;
  }> = [];

  // Filter out hidden groups
  const visibleGroups = groups.filter((g) => !g.hidden);

  visibleGroups.forEach((group) => {
    if (group.textures.length === 0) return;

    const gc = getGroupConfig(group.id);

    const areaConfig: AreaConfig = {
      center: gc.area.center,
      size: gc.area.size,
      count: densityToCount(gc.instances.density),
      pattern: gc.instances.pattern,
      seed: gc.instances.seed,
      sizeVariation: gc.textures.sizeVariation,
      rotationVariation: gc.textures.rotationVariation,
    };

    const allPositions = generateAreaPositions(areaConfig);

    // Initialize arrays for each texture in the group
    const variantData = group.textures.map((item) => ({
      texture: item.url,
      filename: item.filename,
      groupId: group.id,
      groupConfig: gc,
      positions: [] as CoordinateTuple[],
      instances: [] as Array<{
        position: CoordinateTuple;
        scale: CoordinateTuple;
        rotation: CoordinateTuple;
      }>,
    }));

    // Randomly assign each position to a texture variant within the group
    allPositions.forEach((position: CoordinateTuple) => {
      const randomIndex = Math.floor(Math.random() * group.textures.length);
      const variant = variantData[randomIndex];
      variant.positions.push(position);

      // Generate instance with variations using group properties
      const { sizeVariation, rotationVariation, baseSize } = gc.textures;
      const hasVariation =
        sizeVariation.some((v) => v !== 0) || rotationVariation.some((v) => v !== 0);

      if (hasVariation) {
        variant.instances.push({
          position,
          scale: [
            baseSize[0] + (Math.random() - 0.5) * sizeVariation[0],
            baseSize[1] + (Math.random() - 0.5) * sizeVariation[1],
            baseSize[2] + (Math.random() - 0.5) * sizeVariation[2],
          ] as CoordinateTuple,
          rotation: [
            (Math.random() - 0.5) * rotationVariation[0],
            (Math.random() - 0.5) * rotationVariation[1],
            (Math.random() - 0.5) * rotationVariation[2],
          ] as CoordinateTuple,
        });
      }
    });

    allVariantData.push(...variantData);
  });

  return allVariantData;
};

// Remove all meshes belonging to a group from the scene
const removeGroupMeshes = (groupId: string) => {
  if (!currentScene) return;
  const prefix = `grp-${groupId}-`;
  const wireframeName = `wireframe-${groupId}`;
  const toRemove = currentScene.children.filter(
    (child: any) => child.name?.startsWith(prefix) || child.name === wireframeName
  );
  toRemove.forEach((child: any) => currentScene.remove(child));
};

// Add meshes for a single group to the existing scene
const addGroupMeshes = (group: TextureGroup) => {
  if (!currentScene || !currentWorld) return;
  if (group.hidden || group.textures.length === 0) return;

  const gc = getGroupConfig(group.id);

  // Add wireframe if enabled
  if (group.showWireframe) {
    getCube(currentScene, currentWorld, {
      name: `wireframe-${group.id}`,
      size: gc.area.size,
      position: gc.area.center,
      color: 0x00ff00,
      material: "MeshBasicMaterial",
      wireframe: true,
      type: "fixed" as const,
      castShadow: false,
      receiveShadow: false,
      physics: false,
    });
  }

  const variantData = createTextureInstances([group]);

  variantData.forEach((variant) => {
    const elementsData =
      variant.instances.length > 0
        ? variant.instances
        : variant.positions.map((pos: CoordinateTuple) => ({ position: pos }));

    elementsData.forEach((elementData: any, index: number) => {
      getCube(currentScene, currentWorld, {
        name: `grp-${group.id}-${variant.filename}-${index}`,
        size: elementData.scale || variant.groupConfig.textures.baseSize,
        position: elementData.position,
        rotation: elementData.rotation || ([0, 0, 0] as CoordinateTuple),
        texture: variant.texture,
        material: "MeshBasicMaterial",
        opacity: 1,
        color: 0xffffff,
        type: "fixed" as const,
        castShadow: false,
        physics: false,
        receiveShadow: false,
      });
    });
  });

  updateSceneElements(currentScene);
};

// Regenerate only a specific group's meshes in the scene
const regenerateGroupMeshes = (groupId: string) => {
  if (!currentScene) {
    reinitScene();
    return;
  }
  const group = textureGroups.value.find((g) => g.id === groupId);
  if (!group) return;

  removeGroupMeshes(groupId);
  addGroupMeshes(group);
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

  const { orbit, ground } = await setup({
    config: {
      camera: {
        position: sceneConfig.value.camera.position,
        fov: sceneConfig.value.camera.fov,
      },
      orbit: {
        target: new THREE.Vector3(...sceneConfig.value.camera.target),
      },
      lights: {
        ambient: {
          color: 0xffffff,
          intensity: 1.0,
        },
        directional: {
          color: 0xffffff,
          intensity: 1.0,
          position: [20, 30, 20],
          castShadow: false,
        },
      },
      ground: sceneConfig.value.ground.enabled
        ? {
            size: [1000, 100, 1000],
            color: sceneConfig.value.ground.color,
          }
        : false,
      sky: sceneConfig.value.sky.enabled
        ? {
            size: 500,
            color: sceneConfig.value.sky.color,
          }
        : false,
    },
    defineSetup: () => {
      // Add meshes for all groups
      textureGroups.value.forEach((group) => addGroupMeshes(group));

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

  // Sync orbit control changes back to camera config (after setup completes)
  if (orbit) {
    orbitControls = orbit;

    const syncCameraToConfig = () => {
      sceneConfig.value.camera.position = [
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ] as CoordinateTuple;
      sceneConfig.value.camera.target = [
        orbit.target.x,
        orbit.target.y,
        orbit.target.z,
      ] as CoordinateTuple;
    };

    orbit.addEventListener("change", syncCameraToConfig);
  }

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
  groupConfigRegistry,
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

    <!-- Panel Components (rendered without individual triggers) -->
    <TexturesPanel
      :texture-groups="textureGroups"
      :selected-group-id="selectedGroupId"
      :auto-update="autoUpdate"
      @select-group="selectGroup"
      @remove-group="removeGroup"
      @remove-texture="removeTextureFromGroup"
      @toggle-visibility="toggleGroupVisibility"
      @toggle-wireframe="toggleGroupWireframe"
      @file-change="handleFileUpload"
      @add-texture="handleAddTextureToGroup"
      @update:auto-update="autoUpdate = $event"
      @manual-update="triggerManualUpdate"
    />

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
