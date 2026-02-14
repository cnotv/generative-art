<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
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
  hidden?: boolean;
  showWireframe?: boolean;
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

// Create reactive configuration
const reactiveConfig = createReactiveConfig<SceneEditorConfig>(defaultConfig);

// Watch selected texture and register/update its config panel
watch(selectedTextureId, (textureId) => {
  if (textureId) {
    const texture = textureItems.value.find((item) => item.id === textureId);
    if (texture) {
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

      // Create a reactive config for this specific texture
      const textureReactiveConfig = createReactiveConfig({
        textures: { ...textureConfigRegistry.value[textureId] },
      });

      // Register this texture's config with a unique key (filename)
      const configKey = `${route.name as string}:${texture.filename}`;
      registerViewConfig(
        configKey,
        textureReactiveConfig,
        {
          textures: configControls.textures,
        },
        undefined,
        undefined,
        () => {
          // When texture config changes, update the registry and reinit scene
          textureConfigRegistry.value[textureId] = {
            ...textureReactiveConfig.value.textures,
          };

          // Also update the textureProperties system for backward compatibility
          if (!reactiveConfig.value.textureProperties[texture.filename]) {
            reactiveConfig.value.textureProperties[texture.filename] = {};
          }
          reactiveConfig.value.textureProperties[texture.filename].baseSize =
            textureReactiveConfig.value.textures.baseSize;
          reactiveConfig.value.textureProperties[texture.filename].sizeVariation =
            textureReactiveConfig.value.textures.sizeVariation;
          reactiveConfig.value.textureProperties[texture.filename].rotationVariation =
            textureReactiveConfig.value.textures.rotationVariation;

          reinitScene();
        }
      );
    }
  } else {
    // When no texture is selected, show the main scene config
    registerViewConfig(
      route.name as string,
      reactiveConfig,
      configControls,
      sceneConfig,
      sceneControls,
      reinitScene
    );
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

  // Open textures panel on page load
  openPanel("textures");
});

onBeforeUnmount(() => {
  // Clear view-specific panels
  clearViewPanels();

  // Unregister main scene config
  unregisterViewConfig(route.name as string);

  // Unregister all texture-specific configs
  textureItems.value.forEach((texture) => {
    unregisterViewConfig(`${route.name as string}:${texture.filename}`);
  });

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

// Toggle texture visibility
const toggleTextureVisibility = (id: string) => {
  const item = textureItems.value.find((t) => t.id === id);
  if (item) {
    item.hidden = !item.hidden;
    reinitScene();
  }
};

// Remove texture item
const removeTexture = (id: string) => {
  const item = textureItems.value.find((t) => t.id === id);
  if (item) {
    // Unregister the texture's config panel
    unregisterViewConfig(`${route.name as string}:${item.filename}`);

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

  // Filter out hidden textures
  const visibleTextures = textureItems.filter((item) => !item.hidden);

  if (visibleTextures.length === 0) return [];

  // Initialize arrays for each texture variant
  const variantData = visibleTextures.map((item) => {
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
    const randomIndex = Math.floor(Math.random() * visibleTextures.length);
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

// Toggle texture wireframe
const toggleTextureWireframe = (id: string) => {
  const texture = textureItems.value.find((item) => item.id === id);
  if (texture) {
    texture.showWireframe = !texture.showWireframe;
    reinitScene();
  }
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
      // Create wireframe boxes for textures with showWireframe enabled
      textureItems.value
        .filter((item) => item.showWireframe)
        .forEach((item) => {
          const areaSize = reactiveConfig.value.area.size;
          const areaCenter = reactiveConfig.value.area.center;

          getCube(scene, world, {
            size: areaSize,
            position: areaCenter,
            color: 0x00ff00,
            material: "MeshBasicMaterial",
            wireframe: true,
            type: "fixed" as const,
            castShadow: false,
            receiveShadow: false,
            physics: false,
          });
        });
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
              type: "fixed" as const,
              castShadow: false,
              physics: false,
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
  textureConfigRegistry,
  selectedTextureId,
  handleFileUpload,
  selectTexture,
  removeTexture,
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
      @toggle-visibility="toggleTextureVisibility"
      @toggle-wireframe="toggleTextureWireframe"
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
