<script setup>
import { onMounted, ref } from "vue";
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
let chameleonModel = null;

const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
    stats: { init: () => {}, start: () => {}, stop: () => {} },
    route: { query: {} },
    canvas: canvas.value,
  });

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      chameleonModel = await getModel(scene, world, "chameleon.fbx", chameleonConfig);

      // Extract animation names
      if (chameleonModel.actions) {
        availableAnimations.value = Object.keys(chameleonModel.actions);
        if (availableAnimations.value.length > 0) {
          selectedAnimation.value = availableAnimations.value[0];
        }
      }

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            action: () => {
              if (
                selectedAnimation.value &&
                chameleonModel.actions[selectedAnimation.value]
              ) {
                updateAnimation(
                  chameleonModel.mixer,
                  chameleonModel.actions[selectedAnimation.value],
                  getDelta(),
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

onMounted(async () => init());
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="availableAnimations.length > 0" class="animation-controls">
    <label for="animation-select">Animation:</label>
    <select id="animation-select" v-model="selectedAnimation" @change="onAnimationChange">
      <option v-for="animName in availableAnimations" :key="animName" :value="animName">
        {{ animName }}
      </option>
    </select>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.animation-controls {
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 15px;
  border-radius: 5px;
  color: white;
  font-family: monospace;
  z-index: 1000;
}

.animation-controls label {
  margin-right: 10px;
}

.animation-controls select {
  padding: 5px 10px;
  border-radius: 3px;
  border: 1px solid #555;
  background: #333;
  color: white;
  font-family: monospace;
  cursor: pointer;
}

.animation-controls select:hover {
  background: #444;
}
</style>
