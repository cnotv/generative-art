<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  instanceMatrixMesh,
  cameraFollowPlayer,
} from "@webgamekit/threejs";
import { controllerTurn, controllerForward, type ComplexModel, type CoordinateTuple, updateAnimation } from "@webgamekit/animation";
import { createGame } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";
import type { GameState } from "@webgamekit/game";
import { getCube } from "@webgamekit/threejs";
import {
  chameleonConfig,
  mushroomConfig,
  illustrations,
  setupConfig,
  gameSettings,
  controlBindings,
  assets,
} from "./config";

// Use correct GameState type and initialization
const gameState = shallowRef<GameState>();
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const isJumping = shallowRef(false);
const canJump = shallowRef(true);
const logs = shallowRef<string[]>([]);
const showLogs = false;

const handleJump = (): void => {
  if (isJumping.value || !canJump.value) return;
  playAudioFile(assets.jumpSound);
  isJumping.value = true;
  canJump.value = false;
};

const getLogs = (actions: Record<string, any>): string[] =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map(
      (action) =>
        `${action} triggered by ${actions[action].trigger} ${actions[action].device}`
    );

const bindings = {
  ...controlBindings,
  onAction: (action: string) => {
    logs.value = getLogs(currentActions);

    switch (action) {
      case "jump":
        handleJump();
        break;
      case "print-log":
        break;
    }
  },
  onRelease: () => {
    logs.value = getLogs(currentActions);
  },
};
const { destroyControls, currentActions, remapControlsOptions } = createControls(
  bindings
);

const canvas = ref<HTMLCanvasElement | null>(null);
const init = async (): Promise<void> => {
  if (!canvas.value) return;
  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async () => {
      const { distance, speed, maxJump } = gameSettings;
      const obstacles: ComplexModel[] = [];
      const cameraOffset = (setupConfig.camera?.position || [0, 10, 20]) as CoordinateTuple;

      // const player = await getModel(scene, world, "chameleon.fbx", chameleonConfig);
      const player = await getModel(scene, world, "mushroom.glb", mushroomConfig);
      // obstacles.push(await getModel(scene, world, "sand_block.glb", blockConfig));

      Object.keys(illustrations).forEach((key) => {
        const config = (illustrations as Record<string, any>)[key];
        const mesh = getCube(scene, world, config);
        if (config.instances) {
          instanceMatrixMesh(mesh as any, scene, config.instances);
        }
        // obstacles.push(model);
      });

      remapControlsOptions(bindings);

      animate({
        beforeTimeline: () => { },
        timeline: [
          {
            frequency: speed.movement,
            name: "Walk",
            action: () => {
              const actionName = currentActions["moving"]
                ? "Esqueleto|walking"
                : "Esqueleto|idle";
              const action = player.userData.actions?.[actionName];

              if (!action || !player.userData.mixer) return;

              if (currentActions["moving"]) {
                controllerForward(
                  player,
                  obstacles,
                  distance,
                  getDelta() * 2,
                  actionName,
                  true
                );
                cameraFollowPlayer(camera, player, cameraOffset, orbit, ['x', 'z']);
              } else {
                updateAnimation(
                  player.userData.mixer,
                  action,
                  getDelta(),
                  10,
                  player,
                  actionName
                );
              }
            },
          },
          {
            name: "Free: Turn player",
            frequency: speed.movement,
            action: () => {
              if (currentActions["turn-left"]) controllerTurn(player, speed.turning);
              if (currentActions["turn-right"])
                controllerTurn(player, -speed.turning);
            },
          },
          {
            name: "Jump action",
            action: () => {
              if (isJumping.value) {
                if (player.position.y >= chameleonConfig.position[1] + maxJump) {
                  isJumping.value = false;
                } else {
                  player.position.y += speed.jump * 0.1;
                }
              } else {
                player.position.y -= speed.jump * 0.1;
              }

              // Fake gravity
              if (player.position.y <= chameleonConfig.position[1] + 0.1) {
                canJump.value = true;
                player.position.y = chameleonConfig.position[1];
              }
            },
          },
        ],
      });
    },
  });
};

onMounted(async () => {
  await init();
  await initializeAudio();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  stopMusic();
  destroyControls();
  window.removeEventListener("resize", init);
});
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="gameState && showLogs" class="ui">
    <div>
      <span>{{ isJumping ? "Jumping" : "On ground" }},</span>
      <span>{{ canJump ? "ready" : "not ready" }}</span>
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
