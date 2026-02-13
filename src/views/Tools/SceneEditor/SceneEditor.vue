<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { usePanels } from "@/composables/usePanels";
import { useViewPanels } from "@/composables/useViewPanels";
import { getTools, getCube, generateAreaPositions } from "@webgamekit/threejs";
import type { CoordinateTuple, AreaConfig } from "@webgamekit/threejs";
import { createTimelineManager } from "@webgamekit/animation";
import { TexturesPanel, ConfigPanel } from "@/components/panels";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/composables/useViewConfig";
import { defaultConfig, presets, configControls, sceneControls } from "./config";
import type { SceneEditorConfig } from "./config";

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const { openPanel } = usePanels();
const { setViewPanels, clearViewPanels } = useViewPanels();

// Texture items with names
interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

const textureItems = ref<TextureItem[]>([]);
const selectedTextureId = ref<string | null>(null);

// Texture config registry - maps texture IDs to their individual configs
const textureConfigRegistry = ref<
  Record<
    string,
    {
      baseSize: CoordinateTuple;
      sizeVariation: CoordinateTuple;
      rotationVariation: CoordinateTuple;
    }
  >
>({});

// Computed selected texture item
const selectedTexture = computed(() => {
  if (!selectedTextureId.value) return null;
  return textureItems.value.find((item) => item.id === selectedTextureId.value) || null;
});

// Create reactive configuration
const reactiveConfig = createReactiveConfig<SceneEditorConfig>(defaultConfig);

// Watch selected texture and load its config from registry
watch(
  selectedTextureId,
  (textureId) => {
    if (textureId) {
      // Initialize config for this texture if it doesn't exist
      if (!textureConfigRegistry.value[textureId]) {
        textureConfigRegistry.value[textureId] = {
          baseSize: [...defaultConfig.textures.baseSize] as CoordinateTuple,
          sizeVariation: [...defaultConfig.textures.sizeVariation] as CoordinateTuple,
          rotationVariation: [
            ...defaultConfig.textures.rotationVariation,
          ] as CoordinateTuple,
        };
      }
      // Load the texture's config into the reactive config for the panel
      reactiveConfig.value.textures = { ...textureConfigRegistry.value[textureId] };
    } else {
      // Reset to defaults when no texture selected
      reactiveConfig.value.textures = { ...defaultConfig.textures };
    }
  },
  { immediate: true }
);

// Watch config changes and update texture registry
watch(
  () => reactiveConfig.value.textures,
  (newTextures) => {
    if (selectedTextureId.value) {
      // Store this texture's config in the registry
      textureConfigRegistry.value[selectedTextureId.value] = { ...newTextures };

      // Also update the old textureProperties system for backward compatibility
      const filename = selectedTexture.value?.filename;
      if (filename) {
        if (!reactiveConfig.value.textureProperties[filename]) {
          reactiveConfig.value.textureProperties[filename] = {};
        }
        reactiveConfig.value.textureProperties[filename].baseSize = newTextures.baseSize;
        reactiveConfig.value.textureProperties[filename].sizeVariation =
          newTextures.sizeVariation;
        reactiveConfig.value.textureProperties[filename].rotationVariation =
          newTextures.rotationVariation;
      }
      reinitScene();
    }
  },
  { deep: true }
);

// Watch for preset changes and apply them
watch(
  () => reactiveConfig.value.preset,
  (newPreset) => {
    if (newPreset && presets[newPreset as keyof typeof presets]) {
      applyPreset(newPreset as keyof typeof presets);
    }
  }
);

// Scene configuration
const sceneConfig = createReactiveConfig({
  camera: {
    position: [0, 50, 100] as CoordinateTuple,
    fov: 60,
  },
  ground: {
    color: 0x98887d,
  },
  background: {
    color: 0x87ceeb,
  },
});

let animationId = 0;

// Register configuration panel with onChange callback (auto-debounced)
onMounted(() => {
  // Set view-specific panels for GlobalNavigation
  setViewPanels({
    showTextures: true,
    showConfig: true,
  });

  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls,
    reinitScene
  );

  if (canvas.value) {
    initScene();
  }

  // Open config panel on page load
  openPanel("config");
});

onBeforeUnmount(() => {
  // Clear view-specific panels
  clearViewPanels();

  unregisterViewConfig(route.name as string);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});

// Handle texture file upload
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    const textureId = `texture-${Date.now()}`;

    textureItems.value.push({
      id: textureId,
      name: filename,
      filename,
      url,
    });

    // Initialize config for this texture with default values
    textureConfigRegistry.value[textureId] = {
      baseSize: [...reactiveConfig.value.textures.baseSize] as CoordinateTuple,
      sizeVariation: [...reactiveConfig.value.textures.sizeVariation] as CoordinateTuple,
      rotationVariation: [
        ...reactiveConfig.value.textures.rotationVariation,
      ] as CoordinateTuple,
    };

    // Auto-select the newly added texture
    selectedTextureId.value = textureId;
    // Open config panel for the new texture
    openPanel("config");

    reinitScene();
  }
};

// Select texture
const selectTexture = (id: string) => {
  selectedTextureId.value = selectedTextureId.value === id ? null : id;
  // Open config panel when selecting a texture
  if (selectedTextureId.value) {
    openPanel("config");
  }
};

// Remove texture item
const removeTexture = (id: string) => {
  const item = textureItems.value.find((t) => t.id === id);
  if (item) {
    delete reactiveConfig.value.textureProperties[item.filename];
    // Remove from texture config registry
    delete textureConfigRegistry.value[id];
    if (selectedTextureId.value === id) {
      selectedTextureId.value = null;
    }
  }
  textureItems.value = textureItems.value.filter((item) => item.id !== id);
  reinitScene();
};

// Get properties for a specific texture (with fallback to global)
const getTextureProperties = (filename: string): typeof reactiveConfig.value.textures => {
  const specificProps = reactiveConfig.value.textureProperties[filename];
  return {
    baseSize: specificProps?.baseSize || reactiveConfig.value.textures.baseSize,
    sizeVariation:
      specificProps?.sizeVariation || reactiveConfig.value.textures.sizeVariation,
    rotationVariation:
      specificProps?.rotationVariation || reactiveConfig.value.textures.rotationVariation,
    count: specificProps?.count,
    opacity: specificProps?.opacity,
  };
};

// Create texture variants following ForestGame pattern
const createTextureInstances = (
  textureItems: TextureItem[],
  config: SceneEditorConfig
) => {
  if (textureItems.length === 0) return [];

  const areaConfig: AreaConfig = {
    center: config.area.center,
    size: config.area.size,
    count: config.instances.count,
    pattern: config.instances.pattern,
    seed: config.instances.seed,
    sizeVariation: config.textures.sizeVariation,
    rotationVariation: config.textures.rotationVariation,
  };

  const allPositions = generateAreaPositions(areaConfig);

  // Initialize arrays for each texture variant
  const variantData = textureItems.map((item) => {
    const props = getTextureProperties(item.filename);
    return {
      texture: item.url,
      filename: item.filename,
      properties: props,
      positions: [] as CoordinateTuple[],
      instances: [] as Array<{
        position: CoordinateTuple;
        scale: CoordinateTuple;
        rotation: CoordinateTuple;
      }>,
    };
  });

  // Randomly assign each position to a texture variant
  allPositions.forEach((position: CoordinateTuple) => {
    const randomIndex = Math.floor(Math.random() * textureItems.length);
    const variant = variantData[randomIndex];
    variant.positions.push(position);

    // Generate instance with variations using texture-specific properties
    const { sizeVariation, rotationVariation, baseSize } = variant.properties;
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

  return variantData;
};

// Reinitialize scene
const reinitScene = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  if (canvas.value) {
    initScene();
  }
};

// Initialize 3D scene
const initScene = async () => {
  if (!canvas.value) return;

  const { setup, animate, scene, world } = await getTools({
    canvas: canvas.value,
  });

  await setup({
    config: {
      camera: {
        position: sceneConfig.value.camera.position,
        fov: sceneConfig.value.camera.fov,
      },
      ground: {
        size: [1000, 100, 1000],
        color: sceneConfig.value.ground.color,
      },
      sky: {
        size: 500,
        color: sceneConfig.value.background.color,
      },
    },
    defineSetup: () => {
      // Create textured billboards if textures are added
      if (textureItems.value.length > 0) {
        const variantData = createTextureInstances(
          textureItems.value,
          reactiveConfig.value
        );

        variantData.forEach((variant) => {
          // Use instances with variations if available, otherwise use positions
          const elementsData =
            variant.instances.length > 0
              ? variant.instances
              : variant.positions.map((pos: CoordinateTuple) => ({ position: pos }));

          elementsData.forEach((elementData: any) => {
            const cubeConfig = {
              size: elementData.scale || variant.properties.baseSize,
              position: elementData.position,
              rotation: elementData.rotation || ([0, 0, 0] as CoordinateTuple),
              texture: variant.texture,
              material: "MeshBasicMaterial",
              opacity: variant.properties.opacity || 1,
              color: 0xffffff,
              transparent: true,
              depthWrite: false,
              alphaTest: 0.5,
              type: "fixed" as const,
              castShadow: false,
              receiveShadow: false,
            };

            getCube(scene, world, cubeConfig);
          });
        });
      }

      // Create an empty timeline manager (no animations needed for static textures)
      const timelineManager = createTimelineManager();

      animate({
        timeline: timelineManager,
      });
    },
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
  textureItems,
});
</script>

<template>
  <div class="texture-editor">
    <canvas ref="canvas"></canvas>

    <!-- Panel Components (rendered without individual triggers) -->
    <TexturesPanel
      :texture-items="textureItems"
      :selected-texture-id="selectedTextureId"
      @select="selectTexture"
      @remove="removeTexture"
      @file-change="handleFileUpload"
    />

    <ConfigPanel />
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
