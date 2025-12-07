<script setup>
import { onMounted, ref } from "vue";
import * as THREE from "three";
import { getTools, getModel } from "@webgametoolkit/threejs";
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
  material: true,
  materialType: "MeshLambertMaterial",
};

const setupConfig = {
  camera: { position: [0, 5, 20] },
  ground: { size: 10000, color: 0x99cc99 },
  sky: { size: 500, color: 0x87ceeb },
  lights: {
    ambient: {
      color: 0xffffff,
      intensity: 2,
    },
    directional: {
      color: 0xffffff,
      intensity: 4.0,
      position: [20, 30, 20],
      castShadow: true,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: {
          near: 0.5,
          far: 500,
          left: -50,
          right: 50,
          top: 50,
          bottom: -50,
        },
        bias: -0.0001,
        radius: 1,
      },
    },
  },
};

const canvas = ref(null);
const availableAnimations = ref([]);
const selectedAnimation = ref("");
const modelFile = ref(null);
const animationFile = ref(null);
const modelPath = ref("chameleon.fbx");
const animationPath = ref("chameleon_animations.fbx");
const meshColors = ref([]);
const modelScale = ref([0.05, 0.05, 0.05]);

let chameleonModel = null;
let sceneRef = null;
let worldRef = null;
let getDeltaRef = null;

const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
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

const removeModel = () => {
  if (chameleonModel) {
    // Remove from scene
    if (chameleonModel.mesh && sceneRef) {
      sceneRef.remove(chameleonModel.mesh);

      // Dispose of geometries and materials
      chameleonModel.mesh.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    // Remove from physics world
    if (chameleonModel.rigidBody && worldRef) {
      worldRef.removeRigidBody(chameleonModel.rigidBody);
    }

    // Stop all animations
    if (chameleonModel.actions) {
      Object.values(chameleonModel.actions).forEach((action) => action.stop());
    }

    // Clear reference
    chameleonModel = null;
  }

  // Clear UI state
  meshColors.value = [];
  availableAnimations.value = [];
  selectedAnimation.value = "";
};

const loadModel = async () => {
  // Remove existing model first
  removeModel();

  // For blob URLs (uploaded files), we need to load manually
  // because toolkit prepends "/" which breaks blob URLs
  if (modelFile.value && modelPath.value.startsWith("blob:")) {
    await loadModelManually();
  } else {
    await loadModelViaToolkit();
  }

  // Extract mesh colors
  extractMeshColors();

  // Reload animations
  reloadAnimations();
};

const loadModelViaToolkit = async () => {
  const animPathIsGLTF =
    animationPath.value.toLowerCase().endsWith(".glb") ||
    animationPath.value.toLowerCase().endsWith(".gltf");

  const config = {
    ...chameleonConfig,
    scale: modelScale.value,
    animations: !animPathIsGLTF ? animationPath.value : undefined,
  };

  chameleonModel = await getModel(sceneRef, worldRef, modelPath.value, config);
};

const loadModelManually = async () => {
  const fileName = modelFile.value.name.toLowerCase();
  const isGLTF = fileName.endsWith(".glb") || fileName.endsWith(".gltf");

  return new Promise((resolve, reject) => {
    if (isGLTF) {
      import("three/examples/jsm/loaders/GLTFLoader").then(({ GLTFLoader }) => {
        const loader = new GLTFLoader();
        loader.load(
          modelPath.value,
          (gltf) => {
            const mesh = gltf.scene;
            mesh.position.set(...chameleonConfig.position);
            mesh.scale.set(...modelScale.value);

            mesh.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = chameleonConfig.castShadow;
                child.receiveShadow = chameleonConfig.receiveShadow;
              }
            });

            sceneRef.add(mesh);

            // Create physics body
            const RAPIER = worldRef.constructor;
            const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
              ...chameleonConfig.position
            );
            const rigidBody = worldRef.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.cuboid(
              chameleonConfig.boundary,
              chameleonConfig.boundary,
              chameleonConfig.boundary
            );
            const collider = worldRef.createCollider(colliderDesc, rigidBody);

            // Setup animations
            const mixer = new THREE.AnimationMixer(mesh);
            const actions = {};

            if (gltf.animations && gltf.animations.length > 0) {
              gltf.animations.forEach((clip) => {
                actions[clip.name] = mixer.clipAction(clip);
              });
            }

            chameleonModel = {
              mesh,
              rigidBody,
              collider,
              mixer,
              actions,
              type: chameleonConfig.type,
              hasGravity: chameleonConfig.hasGravity,
            };

            resolve();
          },
          undefined,
          reject
        );
      });
    } else {
      // FBX file
      import("three/examples/jsm/loaders/FBXLoader").then(({ FBXLoader }) => {
        const loader = new FBXLoader();
        loader.load(
          modelPath.value,
          (fbx) => {
            const mesh = fbx;
            mesh.position.set(...chameleonConfig.position);
            mesh.scale.set(...modelScale.value);

            mesh.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = chameleonConfig.castShadow;
                child.receiveShadow = chameleonConfig.receiveShadow;
              }
            });

            sceneRef.add(mesh);

            // Create physics body
            const RAPIER = worldRef.constructor;
            const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
              ...chameleonConfig.position
            );
            const rigidBody = worldRef.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.cuboid(
              chameleonConfig.boundary,
              chameleonConfig.boundary,
              chameleonConfig.boundary
            );
            const collider = worldRef.createCollider(colliderDesc, rigidBody);

            // Setup animations
            const mixer = new THREE.AnimationMixer(mesh);
            const actions = {};

            if (fbx.animations && fbx.animations.length > 0) {
              fbx.animations.forEach((clip) => {
                actions[clip.name] = mixer.clipAction(clip);
              });
            }

            chameleonModel = {
              mesh,
              rigidBody,
              collider,
              mixer,
              actions,
              type: chameleonConfig.type,
              hasGravity: chameleonConfig.hasGravity,
            };

            resolve();
          },
          undefined,
          reject
        );
      });
    }
  });
};

const reloadAnimations = () => {
  // Extract animation names
  if (chameleonModel && chameleonModel.actions) {
    availableAnimations.value = Object.keys(chameleonModel.actions);
    if (availableAnimations.value.length > 0) {
      selectedAnimation.value = availableAnimations.value[0];
      chameleonModel.actions[selectedAnimation.value].play();
    }
  } else {
    availableAnimations.value = [];
    selectedAnimation.value = "";
  }
};

const extractMeshColors = () => {
  const colors = [];
  let meshIndex = 0;

  if (chameleonModel && chameleonModel.mesh) {
    chameleonModel.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const material = child.material;
        let color = null;

        if (Array.isArray(material)) {
          // Get color from first material in array
          const firstMat = material[0];
          if (
            firstMat &&
            (firstMat.isMeshStandardMaterial || firstMat.isMeshPhongMaterial)
          ) {
            color = "#" + firstMat.color.getHexString();
          }
        } else if (material.isMeshStandardMaterial || material.isMeshPhongMaterial) {
          color = "#" + material.color.getHexString();
        }

        if (color) {
          colors.push({
            index: meshIndex,
            name: child.name || `Mesh ${meshIndex}`,
            color: color,
            material: material,
          });
        }

        meshIndex++;
      }
    });
  }

  meshColors.value = colors;
};

const onColorChange = (meshItem, newColor) => {
  const hexColor = parseInt(newColor.replace("#", ""), 16);

  if (Array.isArray(meshItem.material)) {
    meshItem.material.forEach((mat) => {
      if (mat.isMeshStandardMaterial || mat.isMeshPhongMaterial) {
        mat.color.setHex(hexColor);
      }
    });
  } else if (
    meshItem.material.isMeshStandardMaterial ||
    meshItem.material.isMeshPhongMaterial
  ) {
    meshItem.material.color.setHex(hexColor);
  }

  // Update the stored color
  meshItem.color = newColor;
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

const onScaleChange = () => {
  if (chameleonModel && chameleonModel.mesh) {
    chameleonModel.mesh.scale.set(...modelScale.value);
  }
};

const onModelFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    modelFile.value = file;
    // For GLB/GLTF files, use the blob URL directly
    // For FBX files, also use the blob URL
    modelPath.value = URL.createObjectURL(file);
    await reloadModel();
  }
};

const onAnimationFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    animationFile.value = file;
    const fileUrl = URL.createObjectURL(file);
    const isGLTF =
      file.name.toLowerCase().endsWith(".glb") ||
      file.name.toLowerCase().endsWith(".gltf");

    // Load new animations and replace existing ones
    if (chameleonModel && chameleonModel.mixer) {
      if (isGLTF) {
        // Load GLTF/GLB animations
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");
        const loader = new GLTFLoader();

        loader.load(fileUrl, (gltf) => {
          if (gltf.animations && gltf.animations.length > 0) {
            // Stop all current animations
            if (chameleonModel.actions) {
              Object.values(chameleonModel.actions).forEach((action) => action.stop());
            }

            // Create new actions from loaded animations
            const newActions = gltf.animations.reduce((acc, animation) => {
              return {
                ...acc,
                [animation.name]: chameleonModel.mixer.clipAction(animation),
              };
            }, {});

            // Replace actions
            chameleonModel.actions = newActions;

            // Reload animations
            reloadAnimations();
          }
        });
      } else {
        // Load FBX animations
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
              [animation.name]: chameleonModel.mixer.clipAction(animation),
            };
          }, {});

          // Replace actions
          chameleonModel.actions = newActions;

          // Reload animations
          reloadAnimations();
        });
      }
    }
  }
};

const reloadModel = async () => {
  removeModel();
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

    <div class="scale-controls">
      <h3 class="section-title">Model Scale</h3>
      <div class="scale-inputs">
        <div class="scale-input-group">
          <label for="scale-x">X: {{ modelScale[0].toFixed(2) }}</label>
          <input
            id="scale-x"
            type="range"
            v-model.number="modelScale[0]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
          />
          <input
            type="number"
            v-model.number="modelScale[0]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
            class="scale-number-input"
          />
        </div>
        <div class="scale-input-group">
          <label for="scale-y">Y: {{ modelScale[1].toFixed(2) }}</label>
          <input
            id="scale-y"
            type="range"
            v-model.number="modelScale[1]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
          />
          <input
            type="number"
            v-model.number="modelScale[1]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
            class="scale-number-input"
          />
        </div>
        <div class="scale-input-group">
          <label for="scale-z">Z: {{ modelScale[2].toFixed(2) }}</label>
          <input
            id="scale-z"
            type="range"
            v-model.number="modelScale[2]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
          />
          <input
            type="number"
            v-model.number="modelScale[2]"
            @input="onScaleChange"
            step="0.01"
            min="0.01"
            max="10"
            class="scale-number-input"
          />
        </div>
      </div>
    </div>

    <div v-if="meshColors.length > 0" class="mesh-colors">
      <h3 class="section-title">Mesh Colors</h3>
      <div class="color-list">
        <div v-for="meshItem in meshColors" :key="meshItem.index" class="color-item">
          <label :for="`color-${meshItem.index}`">{{ meshItem.name }}</label>
          <input
            :id="`color-${meshItem.index}`"
            type="color"
            :value="meshItem.color"
            @input="onColorChange(meshItem, $event.target.value)"
          />
        </div>
      </div>
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

.scale-controls {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #444;
}

.scale-inputs {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.scale-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scale-input-group label {
  font-size: 12px;
  color: #aaa;
  font-weight: 500;
}

.scale-input-group input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #444;
  outline: none;
  cursor: pointer;
}

.scale-input-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #888;
  cursor: pointer;
  transition: background 0.2s;
}

.scale-input-group input[type="range"]::-webkit-slider-thumb:hover {
  background: #aaa;
}

.scale-input-group input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #888;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.scale-input-group input[type="range"]::-moz-range-thumb:hover {
  background: #aaa;
}

.scale-number-input {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: white;
  font-family: monospace;
  font-size: 12px;
  width: 100%;
}

.scale-number-input:focus {
  outline: none;
  border-color: #777;
  background: #3a3a3a;
}

.mesh-colors {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #444;
}

.section-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #ddd;
  font-weight: normal;
}

.color-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.color-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: #222;
  border-radius: 4px;
  border: 1px solid #333;
}

.color-item label {
  flex: 1;
  font-size: 11px;
  color: #ccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-item input[type="color"] {
  width: 40px;
  height: 28px;
  border: 1px solid #555;
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
}

.color-item input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-item input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
</style>
