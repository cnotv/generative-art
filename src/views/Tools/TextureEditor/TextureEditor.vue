<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute } from 'vue-router';
import * as THREE from 'three';
import { getTools, getCube, generateAreaPositions } from '@webgamekit/threejs';
import type { CoordinateTuple, AreaConfig } from '@webgamekit/threejs';
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/composables/useViewConfig';
import { defaultConfig, presets, configControls, sceneControls } from './config';
import type { TextureEditorConfig } from './config';

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const uploadedTextures = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

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

let sceneRef: THREE.Scene | null = null;
let worldRef: any = null;
let animationId = 0;

// Register configuration panel
onMounted(() => {
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls,
    reinitScene
  );
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

  sceneRef = scene;
  worldRef = world;

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

      animate({});
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

// Copy configuration to clipboard
const copyToClipboard = async () => {
  const config = exportConfiguration();
  const jsonString = JSON.stringify(config, null, 2);

  try {
    await navigator.clipboard.writeText(jsonString);
    alert('Configuration copied to clipboard!');
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

    <div class="texture-editor__controls">
      <div class="texture-editor__upload">
        <label class="texture-editor__label">
          Upload Textures (PNG, JPG, WebP)
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            @change="handleFileUpload"
            class="texture-editor__file-input"
          />
        </label>
        <div v-if="uploadedTextures.length > 0" class="texture-editor__preview">
          {{ uploadedTextures.length }} texture(s) uploaded
        </div>
      </div>

      <div class="texture-editor__presets">
        <h3 class="texture-editor__section-title">Presets</h3>
        <button
          data-testid="preset-clouds"
          @click="applyPreset('clouds')"
          class="texture-editor__preset-btn"
        >
          Billboard Clouds
        </button>
        <button
          data-testid="preset-decals"
          @click="applyPreset('decals')"
          class="texture-editor__preset-btn"
        >
          Scattered Decals
        </button>
        <button
          data-testid="preset-grass"
          @click="applyPreset('grass')"
          class="texture-editor__preset-btn"
        >
          Dense Grass
        </button>
      </div>

      <div class="texture-editor__export">
        <button
          data-testid="export-config"
          @click="exportConfiguration"
          class="texture-editor__export-btn"
        >
          Export Config
        </button>
        <button
          data-testid="copy-config"
          @click="copyToClipboard"
          class="texture-editor__export-btn"
        >
          Copy to Clipboard
        </button>
      </div>
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

.texture-editor__controls {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 8px;
  color: white;
  font-family: monospace;
  min-width: 280px;
  z-index: 1000;
}

.texture-editor__label {
  display: block;
  font-size: 14px;
  margin-bottom: 10px;
  cursor: pointer;
}

.texture-editor__file-input {
  display: block;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #222;
  color: white;
  font-size: 12px;
  width: 100%;
  cursor: pointer;
}

.texture-editor__preview {
  margin-top: 10px;
  padding: 8px;
  background: #333;
  border-radius: 4px;
  font-size: 12px;
}

.texture-editor__section-title {
  margin: 20px 0 10px;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid #444;
  padding-bottom: 8px;
}

.texture-editor__presets {
  margin-top: 20px;
}

.texture-editor__preset-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #444;
  border: 1px solid #666;
  border-radius: 4px;
  color: white;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.texture-editor__preset-btn:hover {
  background: #555;
}

.texture-editor__export {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #444;
}

.texture-editor__export-btn {
  display: block;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #2563eb;
  border: none;
  border-radius: 4px;
  color: white;
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.texture-editor__export-btn:hover {
  background: #1d4ed8;
}
</style>
