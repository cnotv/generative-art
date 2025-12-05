<script setup>
import { onMounted, ref } from "vue";
import { getTools, getModel, getAnimations } from "@webgametoolkit/threejs";
import { updateAnimation } from "@webgametoolkit/animation";

const chameleonConfig = {
  position: [0, -0.75, 0],
  scale: [0.05, 0.05, 0.05],
  restitution: -10,
  boundary: 0.5,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  receiveShadow: true,
  animations: "chameleon_animations.fbx",
};

const setupConfig = {
  camera: { position: [0, 5, 20] },
  ground: { size: 10000, color: 0x99cc99 },
  sky: { size: 500, color: 0x87ceeb },
  lights: { directional: { intensity: 0.1 } },
};

const canvas = ref(null);
const availableAnimations = ref([]);
const selectedAnimation = ref("");
const modelFile = ref(null);
const animationFile = ref(null);
const modelPath = ref("chameleon.fbx");
const animationPath = ref("chameleon_animations.fbx");

let chameleonModel = null;
let sceneRef = null;
let worldRef = null;
let getDeltaRef = null;

const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
    stats: { init: () => {}, start: () => {}, stop: () => {} },
    route: { query: {} },
    canvas: canvas.value,
  });

  sceneRef = scene;
  worldRef = world;
  getDeltaRef = getDelta;

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      await loadModel();

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            action: () => {
              if (
                chameleonModel &&
                selectedAnimation.value &&
                chameleonModel.actions[selectedAnimation.value]
              ) {
                updateAnimation(
                  chameleonModel.mixer,
                  chameleonModel.actions[selectedAnimation.value],
                  getDeltaRef(),
                  4
                );
              }
            },
          },
        ],
      });
    },
  });
};

const loadModel = async () => {
  const config = {
    ...chameleonConfig,
    animations: animationPath.value,
  };

  chameleonModel = await getModel(sceneRef, worldRef, modelPath.value, config);

  // Extract animation names
  if (chameleonModel.actions) {
    availableAnimations.value = Object.keys(chameleonModel.actions);
    if (availableAnimations.value.length > 0) {
      selectedAnimation.value = availableAnimations.value[0];
      chameleonModel.actions[selectedAnimation.value].play();
    }
  }
};

const onAnimationChange = () => {
  if (chameleonModel && chameleonModel.actions) {
    // Stop all animations
    Object.values(chameleonModel.actions).forEach((action) => action.stop());
    // Play selected animation
    if (selectedAnimation.value && chameleonModel.actions[selectedAnimation.value]) {
      chameleonModel.actions[selectedAnimation.value].play();
    }
  }
};

const onModelFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    modelFile.value = file;
    modelPath.value = URL.createObjectURL(file);
    await reloadModel();
  }
};

const onAnimationFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    animationFile.value = file;
    const fileUrl = URL.createObjectURL(file);
    
    // Load new animations and replace existing ones
    if (chameleonModel && chameleonModel.mixer) {
      // Load animations directly with FBXLoader to handle blob URL
      const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader");
      const loader = new FBXLoader();
      
      loader.load(fileUrl, (animationFbx) => {
        // Stop all current animations
        if (chameleonModel.actions) {
          Object.values(chameleonModel.actions).forEach((action) => action.stop());
        }
        
        // Create new actions from loaded animations
        const newActions = animationFbx.animations.reduce((acc, animation) => {
          return {
            ...acc,
            [animation.name]: chameleonModel.mixer.clipAction(animation)
          };
        }, {});
        
        // Replace actions
        chameleonModel.actions = newActions;
        
        // Update available animations list
        availableAnimations.value = Object.keys(newActions);
        
        // Select and play first animation
        if (availableAnimations.value.length > 0) {
          selectedAnimation.value = availableAnimations.value[0];
          chameleonModel.actions[selectedAnimation.value].play();
        }
      });
    }
  }
};

const reloadModel = async () => {
  if (chameleonModel && sceneRef) {
    // Remove old model
    sceneRef.remove(chameleonModel.mesh);
    if (chameleonModel.rigidBody && worldRef) {
      worldRef.removeRigidBody(chameleonModel.rigidBody);
    }
  }

  await loadModel();
};

onMounted(async () => init());
</script>

<template>
  <canvas ref="canvas"></canvas>

  <div class="controls">
    <div class="file-inputs">
      <div class="input-group">
        <label for="model-upload">Model (FBX/GLB/GLTF):</label>
        <input
          id="model-upload"
          type="file"
          accept=".fbx,.glb,.gltf"
          @change="onModelFileChange"
        />
      </div>

      <div class="input-group">
        <label for="animation-upload">Animation (FBX/GLB/GLTF):</label>
        <input
          id="animation-upload"
          type="file"
          accept=".fbx,.glb,.gltf"
          @change="onAnimationFileChange"
        />
      </div>
    </div>

    <div v-if="availableAnimations.length > 0" class="animation-select">
      <label for="animation-dropdown">Animation:</label>
      <select
        id="animation-dropdown"
        v-model="selectedAnimation"
        @change="onAnimationChange"
      >
        <option v-for="animName in availableAnimations" :key="animName" :value="animName">
          {{ animName }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.controls {
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 8px;
  color: white;
  font-family: monospace;
  font-size: 13px;
  z-index: 1000;
  min-width: 300px;
}

.file-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #444;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-group label {
  font-size: 12px;
  color: #aaa;
}

.input-group input[type="file"] {
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #222;
  color: white;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
}

.input-group input[type="file"]::file-selector-button {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  margin-right: 8px;
}

.input-group input[type="file"]::file-selector-button:hover {
  background: #555;
}

.animation-select {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.animation-select label {
  font-size: 12px;
  color: #aaa;
}

.animation-select select {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: white;
  font-family: monospace;
  cursor: pointer;
}

.animation-select select:hover {
  background: #444;
}
</style>
