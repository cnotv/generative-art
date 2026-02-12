<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import { getTools, getCube, generateAreaPositions } from "@webgamekit/threejs";
import type { CoordinateTuple, AreaConfig } from "@webgamekit/threejs";
import { createTimelineManager } from "@webgamekit/animation";
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
    const name = newTextureName.value || file.name.replace(/\.[^/.]+$/, "");

    textureItems.value.push({
      id: `texture-${Date.now()}`,
      name,
      url,
    });

    newTextureName.value = "";
    showAddDialog.value = false;
    reinitScene();
  }
};

// Remove texture item
const removeTexture = (id: string) => {
  textureItems.value = textureItems.value.filter((item) => item.id !== id);
  reinitScene();
};

// Create texture variants following ForestGame pattern
const createTextureInstances = (textures: string[], config: TextureEditorConfig) => {
  if (textures.length === 0) return [];

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
  const { sizeVariation, rotationVariation } = config.textures;

  // Initialize arrays for each texture variant
  const variantData = textures.map((texture) => ({
    texture,
    positions: [] as CoordinateTuple[],
    instances: [] as Array<{
      position: CoordinateTuple;
      scale: CoordinateTuple;
      rotation: CoordinateTuple;
    }>,
  }));

  // Randomly assign each position to a texture variant
  allPositions.forEach((position: CoordinateTuple) => {
    const randomIndex = Math.floor(Math.random() * textures.length);
    variantData[randomIndex].positions.push(position);

    // Generate instance with variations
    const hasVariation =
      sizeVariation.some((v) => v !== 0) || rotationVariation.some((v) => v !== 0);

    if (hasVariation) {
      variantData[randomIndex].instances.push({
        position,
        scale: [
          config.textures.baseSize[0] + (Math.random() - 0.5) * sizeVariation[0],
          config.textures.baseSize[1] + (Math.random() - 0.5) * sizeVariation[1],
          config.textures.baseSize[2] + (Math.random() - 0.5) * sizeVariation[2],
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
        const textureUrls = textureItems.value.map((item) => item.url);
        const variantData = createTextureInstances(textureUrls, reactiveConfig.value);

        variantData.forEach((variant) => {
          // Use instances with variations if available, otherwise use positions
          const elementsData =
            variant.instances.length > 0
              ? variant.instances
              : variant.positions.map((pos: CoordinateTuple) => ({ position: pos }));

          elementsData.forEach((elementData: any) => {
            const cubeConfig = {
              size: elementData.scale || reactiveConfig.value.textures.baseSize,
              position: elementData.position,
              rotation: elementData.rotation || ([0, 0, 0] as CoordinateTuple),
              texture: variant.texture,
              material: "MeshBasicMaterial",
              opacity: 1,
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
        >
          <span class="texture-editor__texture-name">{{ item.name }}</span>
          <button
            @click="removeTexture(item.id)"
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
</style>
