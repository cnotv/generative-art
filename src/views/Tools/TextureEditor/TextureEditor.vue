<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { getTools, getCube, generateAreaPositions } from '@webgamekit/threejs';
import type { CoordinateTuple, AreaConfig } from '@webgamekit/threejs';
import { createTimelineManager } from '@webgamekit/animation';
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/composables/useViewConfig';
import { defaultConfig, presets, configControls, sceneControls } from './config';
import type { TextureEditorConfig } from './config';

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const uploadedTextures = ref<string[]>([]);

// Create reactive configuration
const reactiveConfig = createReactiveConfig<TextureEditorConfig>(defaultConfig);

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

// Handle texture file upload
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    uploadedTextures.value = Array.from(files).map(file => URL.createObjectURL(file));
    reinitScene();
  }
};

// Create texture variants following ForestGame pattern
const createTextureInstances = (
  textures: string[],
  config: TextureEditorConfig
) => {
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
  const variantData = textures.map(texture => ({
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
    const hasVariation = sizeVariation.some(v => v !== 0) || rotationVariation.some(v => v !== 0);

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
      // Create textured billboards if textures are uploaded
      if (uploadedTextures.value.length > 0) {
        const variantData = createTextureInstances(
          uploadedTextures.value,
          reactiveConfig.value
        );

        variantData.forEach((variant) => {
          // Use instances with variations if available, otherwise use positions
          const elementsData = variant.instances.length > 0
            ? variant.instances
            : variant.positions.map((pos: CoordinateTuple) => ({ position: pos }));

          elementsData.forEach((elementData: any) => {
            const cubeConfig = {
              size: elementData.scale || reactiveConfig.value.textures.baseSize,
              position: elementData.position,
              rotation: elementData.rotation || [0, 0, 0] as CoordinateTuple,
              texture: variant.texture,
              material: reactiveConfig.value.material.type,
              opacity: reactiveConfig.value.material.opacity,
              transparent: reactiveConfig.value.material.transparent,
              depthWrite: reactiveConfig.value.material.depthWrite,
              alphaTest: reactiveConfig.value.material.alphaTest,
              type: 'fixed' as const,
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
          color: 0xcccccc,
          material: 'MeshBasicMaterial',
          type: 'fixed',
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
    textures: reactiveConfig.value.textures,
    instances: reactiveConfig.value.instances,
    area: reactiveConfig.value.area,
    material: reactiveConfig.value.material,
  };
  return config;
};

// Download configuration as JSON file
const downloadConfiguration = () => {
  const config = exportConfiguration();
  const jsonString = JSON.stringify(config, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'texture-editor-config.json';
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
    console.log('✅ Configuration copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
};

// Expose methods for testing
defineExpose({
  exportConfiguration,
  reactiveConfig,
});
</script>

<template>
  <div class="texture-editor">
    <canvas ref="canvas"></canvas>

    <!-- File upload overlay (shown when no textures uploaded) -->
    <div v-if="uploadedTextures.length === 0" class="texture-editor__upload-overlay">
      <div class="texture-editor__upload-prompt">
        <h2>Texture Editor</h2>
        <p>Upload one or more texture images to begin</p>
        <label class="texture-editor__upload-btn">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            @change="handleFileUpload"
            style="display: none"
          />
          Choose Files
        </label>
        <p class="texture-editor__hint">Supports PNG, JPG, WebP</p>
      </div>
    </div>

    <!-- Texture info badge (shown when textures uploaded) -->
    <div v-else class="texture-editor__info-badge">
      {{ uploadedTextures.length }} texture{{ uploadedTextures.length > 1 ? 's' : '' }} loaded
      <button @click="uploadedTextures = []; reinitScene()" class="texture-editor__clear-btn">
        Clear
      </button>
    </div>

    <!-- Action buttons (top-right corner) -->
    <div class="texture-editor__actions">
      <button
        data-testid="preset-clouds"
        @click="applyPreset('clouds')"
        class="texture-editor__action-btn"
        title="Apply billboard clouds preset"
      >
        ☁️ Clouds
      </button>
      <button
        data-testid="preset-decals"
        @click="applyPreset('decals')"
        class="texture-editor__action-btn"
        title="Apply scattered decals preset"
      >
        🎨 Decals
      </button>
      <button
        data-testid="preset-grass"
        @click="applyPreset('grass')"
        class="texture-editor__action-btn"
        title="Apply dense grass preset"
      >
        🌿 Grass
      </button>
      <button
        data-testid="export-config"
        @click="downloadConfiguration"
        class="texture-editor__action-btn"
        title="Download configuration as JSON"
      >
        💾 Export
      </button>
      <button
        data-testid="copy-config"
        @click="copyToClipboard"
        class="texture-editor__action-btn"
        title="Copy configuration to clipboard"
      >
        📋 Copy
      </button>
    </div>

    <!-- Hidden test elements for configuration access -->
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

/* Upload overlay */
.texture-editor__upload-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.texture-editor__upload-prompt {
  text-align: center;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.texture-editor__upload-prompt h2 {
  font-size: 32px;
  margin: 0 0 16px;
  font-weight: 600;
}

.texture-editor__upload-prompt p {
  font-size: 16px;
  margin: 0 0 24px;
  color: rgba(255, 255, 255, 0.7);
}

.texture-editor__upload-btn {
  display: inline-block;
  padding: 14px 32px;
  background: #2563eb;
  border-radius: 8px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.texture-editor__upload-btn:hover {
  background: #1d4ed8;
}

.texture-editor__hint {
  margin-top: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

/* Info badge */
.texture-editor__info-badge {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 20px;
  border-radius: 20px;
  color: white;
  font-family: monospace;
  font-size: 13px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 12px;
}

.texture-editor__clear-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.texture-editor__clear-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Action buttons */
.texture-editor__actions {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 999;
}

.texture-editor__action-btn {
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.texture-editor__action-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateX(-2px);
}
</style>
