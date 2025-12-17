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
import { initializeAudio, stopMusic, playAudioFile } from "@webgametoolkit/audio";
import jumpSound from "@/assets/jump.wav";

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
  material: "MeshLambertMaterial",
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
const logs = shallowRef("");
const currentActions = shallowRef({});

const handleJump = () => {
  if (isJumping.value || !canJump.value) return;
  playAudioFile(jumpSound);
  isJumping.value = true;
  canJump.value = false;
};

const getLogs = (actions) =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map(
      (action) =>
        `${action} triggered by ${actions[action].trigger} ${actions[action].device}`
    );

const bindings = {
  mapping: {
    keyboard: {
      " ": "jump",
      Enter: "toggle-move",
      a: "turn-left",
      d: "turn-right",
      w: "moving",
      s: "moving",
    },
    gamepad: {
      a: "jump",
      b: "toggle-move",
      left: "turn-left",
      right: "turn-right",
    },
    touch: {
      tap: "jump",
    },
  },
  onAction: (action, trigger, device) => {
    if (currentActions.value[action]) return; // Prevent multiple triggers from the keyboard
    currentActions.value = {
      ...currentActions.value,
      [action]: { action, trigger, device },
    };
    logs.value = getLogs(currentActions.value);

    switch (action) {
      case "jump":
        handleJump();
        break;
    }
  },
  onRelease: (action) => {
    currentActions.value = { ...currentActions.value, [action]: null };
    logs.value = getLogs(currentActions.value);
  },
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
      const speed = {
        movement: 1,
        turning: 4,
        jump: 2,
      };
      colorModel(chameleon.mesh, chameleonConfig.materialColors);

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            action: () => {
              if (!currentActions.value["toggle-move"] || currentActions.value["moving"])
                updateAnimation(
                  chameleon.mixer,
                  chameleon.actions["Idle_A"],
                  getDelta(),
                  10
                );
            },
          },
          {
            frequency: speed.movement,
            action: () => {
              if (!currentActions.value["toggle-move"] || currentActions.value["moving"])
                controllerForward(chameleon, [], distance, getDelta(), false);
            },
          },
          {
            frequency: speed.movement * angle,
            action: () => {
              if (!currentActions.value["toggle-move"]) {
                controllerTurn(chameleon, angle);
              }
            },
          },
          {
            frequency: speed.movement,
            action: () => {
              if (currentActions.value["toggle-move"]) {
                if (currentActions.value["turn-left"])
                  controllerTurn(chameleon, speed.turning);
                if (currentActions.value["turn-right"])
                  controllerTurn(chameleon, -speed.turning);
              }
            },
          },
          {
            frequency: speed.movement * angle * 4,
            action: () => {
              if (!currentActions.value["toggle-move"]) {
                gameState.value.setData("score", (gameState.value.data.score || 0) + 1);
              }
            },
          },
          {
            action: () => {
              if (isJumping.value) {
                chameleon.mesh.position.y +=
                  Math.sin((Date.now() * 0.01) / speed.jump) * 0.2;
              } else {
                // chameleon.mesh.position.y -=
                //   Math.sin(Date.now() * 0.01 / speed.jump) * 0.2;
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
  initializeAudio();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  stopMusic();
  window.removeEventListener("resize", init);
});
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="gameState" class="ui">
    <div>
      <span>{{ isJumping ? "Jumping" : "On ground" }},</span>
      <span>{{ canJump ? "ready" : "not ready" }}</span>
      <span
        >-
        {{
          currentActions["toggle-move"]
            ? "Free move"
            : `In the loop (${gameState.data.score || 0})`
        }}</span
      >
    </div>
    <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
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
  font-size: 24px;
  line-height: 1.2em;
  margin: 1rem;
}

@media (max-width: 600px) {
  .ui {
    line-height: 0.2em;
  }
}
</style>
