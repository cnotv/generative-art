<script setup>
import { onMounted, ref } from "vue";
import * as THREE from "three";
import { getTools, getModel } from "@webgamekit/threejs";
import { updateAnimation } from "@webgamekit/animation";

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
  material: "MeshLambertMaterial",
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

// Mesh inspector panel state
const selectedMesh = ref(null);
const panelsVisible = ref(false);
const meshHelper = ref(null);

const meshProperties = ref({
  name: "",
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 0, y: 0, z: 0 },
  material: "",
  color: "",
  opacity: 1,
  visible: true,
  castShadow: false,
  receiveShadow: false,
  geometry: "",
  vertexCount: 0,
  faceCount: 0,
  uuid: "",
  type: "",
  frustumCulled: true,
  renderOrder: 0,
  layers: "",
  matrixAutoUpdate: true,
  // Material properties
  metalness: 0,
  roughness: 1,
  transparent: false,
  side: "",
  flatShading: false,
  wireframe: false,
  vertexColors: false,
  fog: true,
  // Geometry properties
  boundingSphere: null,
  boundingBox: null,
});

let chameleonModel = null;
let sceneRef = null;
let worldRef = null;
let getDeltaRef = null;
let cameraRef = null;

const closePanel = () => {
  panelsVisible.value = false;
  selectedMesh.value = null;
  if (meshHelper.value && sceneRef) {
    sceneRef.remove(meshHelper.value);
    meshHelper.value = null;
  }
};

const init = async () => {
  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

  sceneRef = scene;
  worldRef = world;
  getDeltaRef = getDelta;
  cameraRef = camera;

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      await loadModel();

      // Raycaster for mesh selection
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const onPointerClick = (event) => {
        // Calculate pointer position in normalized device coordinates
        const rect = canvas.value.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the raycaster
        raycaster.setFromCamera(pointer, cameraRef);

        // Calculate objects intersecting the ray
        const intersects = raycaster.intersectObjects(sceneRef.children, true);

        if (intersects.length > 0) {
          const intersectedObject = intersects[0].object;
          if (intersectedObject.isMesh) {
            updateMeshProperties(intersectedObject);
          }
        }
      };

      const updateMeshProperties = (mesh) => {
        if (!mesh) return;

        // Remove previous helper if exists
        if (meshHelper.value) {
          sceneRef.remove(meshHelper.value);
          meshHelper.value = null;
        }

        selectedMesh.value = mesh;
        panelsVisible.value = true;

        // Create and add new helper
        meshHelper.value = new THREE.BoxHelper(mesh, 0x00ff00);
        sceneRef.add(meshHelper.value);

        // Compute bounding box and sphere if not already computed
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        if (!mesh.geometry.boundingSphere) {
          mesh.geometry.computeBoundingSphere();
        }

        const getSideName = (side) => {
          if (side === THREE.FrontSide) return "Front";
          if (side === THREE.BackSide) return "Back";
          if (side === THREE.DoubleSide) return "Double";
          return "Unknown";
        };

        meshProperties.value = {
          name: mesh.name || "Unnamed",
          uuid: mesh.uuid,
          type: mesh.type,
          position: {
            x: mesh.position.x.toFixed(2),
            y: mesh.position.y.toFixed(2),
            z: mesh.position.z.toFixed(2),
          },
          rotation: {
            x: ((mesh.rotation.x * 180) / Math.PI).toFixed(2),
            y: ((mesh.rotation.y * 180) / Math.PI).toFixed(2),
            z: ((mesh.rotation.z * 180) / Math.PI).toFixed(2),
          },
          scale: {
            x: mesh.scale.x.toFixed(2),
            y: mesh.scale.y.toFixed(2),
            z: mesh.scale.z.toFixed(2),
          },
          visible: mesh.visible,
          frustumCulled: mesh.frustumCulled,
          renderOrder: mesh.renderOrder,
          layers: mesh.layers.mask,
          matrixAutoUpdate: mesh.matrixAutoUpdate,
          castShadow: mesh.castShadow,
          receiveShadow: mesh.receiveShadow,
          // Material properties
          material: mesh.material?.type || "N/A",
          color: mesh.material?.color ? `#${mesh.material.color.getHexString()}` : "N/A",
          opacity: mesh.material?.opacity?.toFixed(2) || 1,
          transparent: mesh.material?.transparent || false,
          metalness: mesh.material?.metalness?.toFixed(2) || "N/A",
          roughness: mesh.material?.roughness?.toFixed(2) || "N/A",
          side:
            mesh.material?.side !== undefined ? getSideName(mesh.material.side) : "N/A",
          flatShading: mesh.material?.flatShading || false,
          wireframe: mesh.material?.wireframe || false,
          vertexColors: mesh.material?.vertexColors || false,
          fog: mesh.material?.fog !== undefined ? mesh.material.fog : true,
          // Geometry properties
          geometry: mesh.geometry?.type || "N/A",
          vertexCount: mesh.geometry?.attributes?.position?.count || 0,
          faceCount: mesh.geometry?.index
            ? mesh.geometry.index.count / 3
            : (mesh.geometry?.attributes?.position?.count || 0) / 3,
          boundingSphere: mesh.geometry?.boundingSphere
            ? `radius: ${mesh.geometry.boundingSphere.radius.toFixed(2)}`
            : "N/A",
          boundingBox: mesh.geometry?.boundingBox
            ? `${mesh.geometry.boundingBox.min.x.toFixed(
                1
              )},${mesh.geometry.boundingBox.min.y.toFixed(
                1
              )},${mesh.geometry.boundingBox.min.z.toFixed(
                1
              )} to ${mesh.geometry.boundingBox.max.x.toFixed(
                1
              )},${mesh.geometry.boundingBox.max.y.toFixed(
                1
              )},${mesh.geometry.boundingBox.max.z.toFixed(1)}`
            : "N/A",
        };
      };

      // Add click and touch event listeners
      canvas.value.addEventListener("click", onPointerClick);
      canvas.value.addEventListener("touchend", (event) => {
        if (event.changedTouches.length > 0) {
          const touch = event.changedTouches[0];
          onPointerClick(touch);
        }
      });

      animate({
        beforeTimeline: () => {
          // Update helper if mesh is selected
          if (meshHelper.value && selectedMesh.value) {
            meshHelper.value.update();
          }
        },
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
  <div class="container">
    <canvas ref="canvas"></canvas>

    <!-- Mesh Inspector Panel (left side) -->
    <div v-if="panelsVisible" class="side-panel">
      <div class="panel-header">
        <h3>Mesh Properties</h3>
        <button @click="closePanel" class="close-btn">×</button>
      </div>

      <div class="panel-content">
        <div class="property-group">
          <h4>General</h4>
          <div class="property">
            <span class="label">Name:</span>
            <span class="value">{{ meshProperties.name }}</span>
          </div>
          <div class="property">
            <span class="label">Type:</span>
            <span class="value">{{ meshProperties.type }}</span>
          </div>
          <div class="property">
            <span class="label">UUID:</span>
            <span class="value">{{ meshProperties.uuid.substring(0, 8) }}...</span>
          </div>
          <div class="property">
            <span class="label">Visible:</span>
            <span class="value">{{ meshProperties.visible }}</span>
          </div>
          <div class="property">
            <span class="label">Frustum Culled:</span>
            <span class="value">{{ meshProperties.frustumCulled }}</span>
          </div>
          <div class="property">
            <span class="label">Render Order:</span>
            <span class="value">{{ meshProperties.renderOrder }}</span>
          </div>
          <div class="property">
            <span class="label">Layers:</span>
            <span class="value">{{ meshProperties.layers }}</span>
          </div>
        </div>

        <div class="property-group">
          <h4>Transform</h4>
          <div class="property">
            <span class="label">Position:</span>
            <span class="value"
              >x: {{ meshProperties.position.x }}, y: {{ meshProperties.position.y }}, z:
              {{ meshProperties.position.z }}</span
            >
          </div>
          <div class="property">
            <span class="label">Rotation (deg):</span>
            <span class="value"
              >x: {{ meshProperties.rotation.x }}°, y: {{ meshProperties.rotation.y }}°,
              z: {{ meshProperties.rotation.z }}°</span
            >
          </div>
          <div class="property">
            <span class="label">Scale:</span>
            <span class="value"
              >x: {{ meshProperties.scale.x }}, y: {{ meshProperties.scale.y }}, z:
              {{ meshProperties.scale.z }}</span
            >
          </div>
          <div class="property">
            <span class="label">Matrix Auto Update:</span>
            <span class="value">{{ meshProperties.matrixAutoUpdate }}</span>
          </div>
        </div>

        <div class="property-group">
          <h4>Material</h4>
          <div class="property">
            <span class="label">Type:</span>
            <span class="value">{{ meshProperties.material }}</span>
          </div>
          <div class="property">
            <span class="label">Color:</span>
            <span class="value">
              <span
                class="color-swatch"
                :style="{ backgroundColor: meshProperties.color }"
              ></span>
              {{ meshProperties.color }}
            </span>
          </div>
          <div class="property">
            <span class="label">Opacity:</span>
            <span class="value">{{ meshProperties.opacity }}</span>
          </div>
          <div class="property">
            <span class="label">Transparent:</span>
            <span class="value">{{ meshProperties.transparent }}</span>
          </div>
          <div class="property">
            <span class="label">Side:</span>
            <span class="value">{{ meshProperties.side }}</span>
          </div>
          <div class="property">
            <span class="label">Metalness:</span>
            <span class="value">{{ meshProperties.metalness }}</span>
          </div>
          <div class="property">
            <span class="label">Roughness:</span>
            <span class="value">{{ meshProperties.roughness }}</span>
          </div>
          <div class="property">
            <span class="label">Flat Shading:</span>
            <span class="value">{{ meshProperties.flatShading }}</span>
          </div>
          <div class="property">
            <span class="label">Wireframe:</span>
            <span class="value">{{ meshProperties.wireframe }}</span>
          </div>
          <div class="property">
            <span class="label">Vertex Colors:</span>
            <span class="value">{{ meshProperties.vertexColors }}</span>
          </div>
          <div class="property">
            <span class="label">Fog:</span>
            <span class="value">{{ meshProperties.fog }}</span>
          </div>
        </div>

        <div class="property-group">
          <h4>Shadows</h4>
          <div class="property">
            <span class="label">Cast Shadow:</span>
            <span class="value">{{ meshProperties.castShadow }}</span>
          </div>
          <div class="property">
            <span class="label">Receive Shadow:</span>
            <span class="value">{{ meshProperties.receiveShadow }}</span>
          </div>
        </div>

        <div class="property-group">
          <h4>Geometry</h4>
          <div class="property">
            <span class="label">Type:</span>
            <span class="value">{{ meshProperties.geometry }}</span>
          </div>
          <div class="property">
            <span class="label">Vertices:</span>
            <span class="value">{{ meshProperties.vertexCount }}</span>
          </div>
          <div class="property">
            <span class="label">Faces:</span>
            <span class="value">{{ Math.floor(meshProperties.faceCount) }}</span>
          </div>
          <div class="property">
            <span class="label">Bounding Sphere:</span>
            <span class="value">{{ meshProperties.boundingSphere }}</span>
          </div>
          <div class="property">
            <span class="label">Bounding Box:</span>
            <span class="value" style="font-size: 11px">{{
              meshProperties.boundingBox
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Model Controls Panel (right side) -->
    <div v-if="panelsVisible" class="controls">
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
          <option
            v-for="animName in availableAnimations"
            :key="animName"
            :value="animName"
          >
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

    <!-- Mobile toggle button -->
    <button class="mobile-toggle" @click="panelsVisible = !panelsVisible">
      {{ panelsVisible ? "Hide" : "Show" }} Panel
    </button>
  </div>
</template>

<style scoped>
.container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.controls {
  position: fixed;
  top: 20px;
  right: 20px;
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

/* Mesh Inspector Panel Styles */
.side-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 350px;
  height: 100%;
  background: rgba(20, 20, 30, 0.95);
  color: #fff;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  z-index: 999;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #ff6b6b;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.property-group {
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
}

.property-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #66b3ff;
}

.property {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.property:last-child {
  border-bottom: none;
}

.property .label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.property .value {
  font-size: 13px;
  color: #fff;
  text-align: right;
  font-family: "Courier New", monospace;
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-swatch {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* Scrollbar styling for side panel */
.side-panel::-webkit-scrollbar {
  width: 8px;
}

.side-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.side-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.side-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.mobile-toggle {
  display: none;
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2001;
  background: #222;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5em 1em;
  font-size: 1.2em;
  pointer-events: auto;
}
@media (max-width: 768px) {
  .mobile-toggle {
    display: block;
  }
  .panel {
    position: fixed;
    top: 3.5rem;
    left: 0;
    right: 0;
    background: #fff;
    z-index: 2000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 1em;
  }
}
</style>
