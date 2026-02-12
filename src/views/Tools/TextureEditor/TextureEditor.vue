<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { getTools, getCube, generateAreaPositions } from "@webgamekit/threejs";
import type { CoordinateTuple, AreaConfig } from "@webgamekit/threejs";
import { createTimelineManager } from "@webgamekit/animation";
import { CoordinateInput } from "@/components/ui/coordinate-input";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/composables/useViewConfig";
import { defaultConfig, presets, configControls, sceneControls } from "./config";
import type { TextureEditorConfig } from "./config";

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);

// Texture items with names
interface TextureItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

const textureItems = ref<TextureItem[]>([]);
const showAddDialog = ref(false);
const newTextureName = ref("");
const fileInputRef = ref<HTMLInputElement | null>(null);

// Create reactive configuration
const reactiveConfig = createReactiveConfig<TextureEditorConfig>(defaultConfig);

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
});

onBeforeUnmount(() => {
  unregisterViewConfig(route.name as string);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});

// Handle add texture button click
const handleAddTexture = () => {
  fileInputRef.value?.click();
};

// Handle texture file upload
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const file = files[0];
    const url = URL.createObjectURL(file);
    const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    const name = newTextureName.value || filename;

    textureItems.value.push({
      id: `texture-${Date.now()}`,
      name,
      filename,
      url,
    });

    newTextureName.value = "";
    showAddDialog.value = false;
    reinitScene();
  }
};

// Select texture for configuration
const selectTexture = (filename: string) => {
  reactiveConfig.value.selectedTexture = filename;
};

// Get selected texture info
const selectedItem = computed(() => {
  if (!reactiveConfig.value.selectedTexture) return null;
  return textureItems.value.find(
    (item) => item.filename === reactiveConfig.value.selectedTexture
  );
});

// Get/set properties for selected texture
const selectedTextureProps = computed(() => {
  if (!reactiveConfig.value.selectedTexture) return null;
  return getTextureProperties(reactiveConfig.value.selectedTexture);
});

const updateSelectedProp = (prop: 'baseSize' | 'sizeVariation' | 'rotationVariation' | 'count' | 'opacity', value: any) => {
  const selected = reactiveConfig.value.selectedTexture;
  if (!selected) return;

  if (!reactiveConfig.value.textureProperties[selected]) {
    reactiveConfig.value.textureProperties[selected] = {};
  }

  reactiveConfig.value.textureProperties[selected][prop] = value;
  reinitScene();
};

// Remove texture item
const removeTexture = (id: string) => {
  const item = textureItems.value.find((t) => t.id === id);
  if (item) {
    // Remove from textureProperties if exists
    delete reactiveConfig.value.textureProperties[item.filename];
    // Clear selection if this texture was selected
    if (reactiveConfig.value.selectedTexture === item.filename) {
      reactiveConfig.value.selectedTexture = undefined;
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
    sizeVariation: specificProps?.sizeVariation || reactiveConfig.value.textures.sizeVariation,
    rotationVariation: specificProps?.rotationVariation || reactiveConfig.value.textures.rotationVariation,
    count: specificProps?.count,
    opacity: specificProps?.opacity,
  };
};

// Create texture variants following ForestGame pattern
const createTextureInstances = (textureItems: TextureItem[], config: TextureEditorConfig) => {
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
        const variantData = createTextureInstances(textureItems.value, reactiveConfig.value);

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
              // transparent: true,
              // depthWrite: false,
              // alphaTest: 0.5,
              type: "fixed" as const,
              castShadow: false,
              receiveShadow: true,
            };

            getCube(scene, world, cubeConfig);
          });
        });
      } else {
        // Show placeholder cube when no texture is uploaded
        getCube(scene, world, {
          size: [20, 20, 0.1] as CoordinateTuple,
          position: [0, 0, 0] as CoordinateTuple,
          color: 0xffffff,
          material: "MeshBasicMaterial",
          type: "fixed",
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

// Download configuration as JSON file
const downloadConfiguration = () => {
  const config = exportConfiguration();
  const jsonString = JSON.stringify(config, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "texture-editor-config.json";
  link.click();
  URL.revokeObjectURL(url);
};

// Copy configuration to clipboard
const copyToClipboard = async () => {
  const config = exportConfiguration();
  const jsonString = JSON.stringify(config, null, 2);

  try {
    await navigator.clipboard.writeText(jsonString);
    // Use console instead of alert for better UX
    console.log("✅ Configuration copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
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

    <!-- Top center controls -->
    <div class="texture-editor__top-controls">
      <!-- Add texture button -->
      <button
        @click="handleAddTexture"
        class="texture-editor__add-btn"
        title="Add texture"
      >
        ➕ Add Texture
      </button>

      <!-- Hidden file input -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        @change="handleFileUpload"
        style="display: none"
      />

      <!-- Texture list dropdown -->
      <div v-if="textureItems.length > 0" class="texture-editor__texture-list">
        <div
          v-for="item in textureItems"
          :key="item.id"
          class="texture-editor__texture-item"
          :class="{ 'texture-editor__texture-item--selected': reactiveConfig.selectedTexture === item.filename }"
          @click="selectTexture(item.filename)"
        >
          <span class="texture-editor__texture-name">{{ item.name }}</span>
          <button
            @click.stop="removeTexture(item.id)"
            class="texture-editor__remove-btn"
            title="Remove texture"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="texture-editor__actions">
        <button
          @click="downloadConfiguration"
          class="texture-editor__action-btn"
          title="Download configuration as JSON"
        >
          💾 Export
        </button>
        <button
          @click="copyToClipboard"
          class="texture-editor__action-btn"
          title="Copy configuration to clipboard"
        >
          📋 Copy
        </button>
      </div>
    </div>

    <!-- Selected Texture Properties Panel -->
    <div v-if="selectedItem && selectedTextureProps" class="texture-editor__selected-props">
      <div class="texture-editor__selected-props-header">
        <h3>{{ selectedItem.name }} Properties</h3>
        <button @click="reactiveConfig.selectedTexture = undefined" class="texture-editor__close-btn">✕</button>
      </div>
      <div class="texture-editor__selected-props-content">
        <CoordinateInput
          :model-value="selectedTextureProps.baseSize"
          label="Base Size"
          :min="{ x: 1, y: 1, z: 0 }"
          :max="{ x: 500, y: 500, z: 10 }"
          :step="{ x: 1, y: 1, z: 0.1 }"
          @update:model-value="updateSelectedProp('baseSize', $event)"
        />
        <CoordinateInput
          :model-value="selectedTextureProps.sizeVariation"
          label="Size Variation"
          :min="{ x: 0, y: 0, z: 0 }"
          :max="{ x: 200, y: 200, z: 10 }"
          :step="{ x: 1, y: 1, z: 0.1 }"
          @update:model-value="updateSelectedProp('sizeVariation', $event)"
        />
        <CoordinateInput
          :model-value="selectedTextureProps.rotationVariation"
          label="Rotation Variation"
          :min="{ x: 0, y: 0, z: 0 }"
          :max="{ x: Math.PI * 2, y: Math.PI * 2, z: Math.PI * 2 }"
          :step="{ x: 0.1, y: 0.1, z: 0.1 }"
          @update:model-value="updateSelectedProp('rotationVariation', $event)"
        />
      </div>
    </div>

    <!-- Hidden test elements for configuration access -->
    <button
      data-testid="preset-clouds"
      @click="applyPreset('clouds')"
      style="display: none"
    >
      Clouds
    </button>
    <button
      data-testid="preset-decals"
      @click="applyPreset('decals')"
      style="display: none"
    >
      Decals
    </button>
    <button
      data-testid="preset-grass"
      @click="applyPreset('grass')"
      style="display: none"
    >
      Grass
    </button>
    <button
      data-testid="export-config"
      @click="downloadConfiguration"
      style="display: none"
    >
      Export
    </button>
    <button data-testid="copy-config" @click="copyToClipboard" style="display: none">
      Copy
    </button>
    <select
      v-model="reactiveConfig.instances.pattern"
      data-testid="pattern-select"
      style="display: none"
    >
      <option value="random">Random</option>
      <option value="grid">Grid</option>
      <option value="grid-jitter">Grid Jitter</option>
    </select>
    <input
      v-model.number="reactiveConfig.instances.seed"
      data-testid="seed-input"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.instances.count"
      data-testid="instance-count"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.sizeVariation[0]"
      data-testid="size-variation-x"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.sizeVariation[1]"
      data-testid="size-variation-y"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.sizeVariation[2]"
      data-testid="size-variation-z"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.rotationVariation[0]"
      data-testid="rotation-variation-x"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.rotationVariation[1]"
      data-testid="rotation-variation-y"
      type="number"
      style="display: none"
    />
    <input
      v-model.number="reactiveConfig.textures.rotationVariation[2]"
      data-testid="rotation-variation-z"
      type="number"
      style="display: none"
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

/* Top controls */
.texture-editor__top-controls {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 12px;
}

.texture-editor__add-btn {
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.texture-editor__add-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
}

.texture-editor__texture-list {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.texture-editor__texture-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.texture-editor__texture-item:hover {
  background: rgba(255, 255, 255, 0.15);
}

.texture-editor__texture-item--selected {
  background: rgba(76, 175, 80, 0.5);
  border: 1px solid rgba(76, 175, 80, 0.8);
}

.texture-editor__texture-name {
  font-family: monospace;
}

.texture-editor__remove-btn {
  padding: 2px 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
}

.texture-editor__remove-btn:hover {
  color: #ff6b6b;
}

.texture-editor__actions {
  display: flex;
  gap: 8px;
}

.texture-editor__action-btn {
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.texture-editor__action-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
}

/* Selected Texture Properties Panel */
.texture-editor__selected-props {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 320px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  z-index: 998;
  overflow: hidden;
}

.texture-editor__selected-props-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.texture-editor__selected-props-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.texture-editor__close-btn {
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.2s;
}

.texture-editor__close-btn:hover {
  color: #ff6b6b;
}

.texture-editor__selected-props-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
