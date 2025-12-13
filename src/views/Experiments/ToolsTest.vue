<script setup>
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { getTools, getModel, colorModel } from "@webgametoolkit/threejs";
import {
  updateAnimation,
  controllerTurn,
  controllerForward,
} from "@webgametoolkit/animation";
import waterImage from "@/assets/water.png";
import { createGame } from "@webgametoolkit/game";
import { createControls } from "@webgametoolkit/controls";

const chameleonConfig = {
  position: [0, -0.75, 0],
  scale: [0.05, 0.05, 0.05],
  restitution: -10,
  boundary: 0.5,
  // type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  receiveShadow: true,
  animations: "chameleon_animations.fbx",
  material: true,
  materialType: "MeshLambertMaterial",
};

const setupConfig = {
  camera: { position: [0, 5, 20] },
  ground: {
    size: 10000,
    texture: waterImage,
    textureRepeat: [400, 400],
    color: 0x99cc99,
  },
  sky: { size: 500, color: 0x87ceeb },
  lights: { directional: { intensity: 0.1 } },
};

const gameState = shallowRef({ data: { score: 0 } });
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const isJumping = shallowRef(false);
const canJump = shallowRef(true);
const handleJump = () => {
  if (isJumping.value || !canJump.value) return;
  isJumping.value = true;
  canJump.value = false;
};
const bindings = {
  mapping: {
    keyboard: {
      " ": "jump",
    },
    gamepad: {
      a: "jump",
    },
    touch: {
      tap: "jump",
    },
  },
  onAction: () => handleJump(),
};
createControls(bindings);

const canvas = ref(null);
const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
    canvas: canvas.value,
  });

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      const chameleon = await getModel(scene, world, "chameleon.fbx", chameleonConfig);
      const angle = 90;
      const distance = 0.1;
      const speed = 1;
      colorModel(chameleon.mesh, chameleonConfig.materialColors);

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            action: () =>
              updateAnimation(
                chameleon.mixer,
                chameleon.actions["Idle_A"],
                getDelta(),
                10
              ),
          },
          {
            frequency: speed,
            action: () => controllerForward(chameleon, [], distance, getDelta(), false),
          },
          {
            frequency: speed * angle,
            action: () => controllerTurn(chameleon, angle),
          },
          {
            frequency: speed * angle * 4,
            action: () =>
              gameState.value.setData("score", (gameState.value.data.score || 0) + 1),
          },
          {
            action: () => {
              const jumpSpeed = 2;
              if (isJumping.value) {
                chameleon.mesh.position.y +=
                  Math.sin((Date.now() * 0.01) / jumpSpeed) * 0.2;
              } else {
                // chameleon.mesh.position.y -=
                //   Math.sin(Date.now() * 0.01 / jumpSpeed) * 0.2;
              }

              if (chameleon.mesh.position.y <= chameleonConfig.position[1] + 0.1) {
                isJumping.value = false;
                canJump.value = true;
                chameleon.mesh.position.y = chameleonConfig.position[1];
              }
            },
          },
        ],
      });
    },
  });
};

onMounted(async () => {
  init();
  window.addEventListener("resize", init);
});
onUnmounted(() => window.removeEventListener("resize", init));
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="gameState" class="ui">
    <p>Jumping: {{ isJumping }}</p>
    <p>Can jump? {{ canJump }}</p>
    <h1>Loops: {{ gameState.data.score || 0 }}</h1>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
.ui {
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  font-size: 18px;
  line-height: 1.2em;
  justify-self: center;
}

h1 {
  font-size: 4em;
}

p {
  font-size: 2em;
}

@media (max-width: 600px) {
  .ui {
    line-height: 0.2em;
  }
}
</style>
