<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import StartScreen from "./screens/StartScreen.vue";
import GameOver from "./screens/GameOver.vue";
import ScoreDisplay from "./screens/ScoreDisplay.vue";
import { createControls } from "@webgamekit/controls";
import { stats } from "@/utils/stats";
import { initializeAudio, stopMusic } from "@webgamekit/audio";
import { getTools } from "@webgamekit/threejs";
import { useUiStore } from "@/stores/ui";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { config, setupConfig, configControls, textureAreaControls } from "./config";
import { registerCameraProperties as registerCameraPropertiesUtility } from "@/utils/cameraProperties";
import { registerLightProperties } from "@/utils/lightProperties";
import { registerTextureAreaProperties } from "@/utils/textureAreaProperties";
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from "@/stores/viewConfig";
import { createTimeline } from "./animation";
import "@/assets/prevents.css";
import "./styles.css";

import { handleJumpGoomba } from "./helpers/events";
import { useDebugSceneStore } from '@/stores/debugScene';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { useTextureGroupsStore } from '@/stores/textureGroups';

import {
  prevents,
  loadHighScore,
  checkHighScore,
  isGameOver,
  isGameStart,
  isGamePlaying,
  setStatus,
  setScore,
} from "./helpers/setup";
import type { ControlsOptions } from "packages/controls/dist";

type LightObject = { color: { getHex: () => number; set: (v: number) => void }; intensity: number };

const uiStore = useUiStore();
const fontName = "goomba-runner-font";
const shouldClearObstacles = ref(false);
const statsElement = ref(null);
const canvas = ref(null);
const route = useRoute();
const { originalViewport, preventZoomStyleElement } = enableZoomPrevention();

// Reactive config for Config panel (game/player settings)
const reactiveConfig = createReactiveConfig({
  game: {
    helper: config.game.helper,
    speed: config.game.speed,
  },
  player: {
    helper: config.player.helper,
    speed: config.player.speed,
    maxJump: config.player.maxJump,
    jump: {
      height: config.player.jump.height,
      duration: config.player.jump.duration,
    },
  },
});

const bindings: Record<string, ControlsOptions> = {
  playing: {
    mapping: {
      keyboard: {
        " ": "jump",
      },
      gamepad: {
        cross: "jump",
      },
      touch: {
        tap: "jump",
      },
    },
    onAction: (action) => {
      if (action === "jump") handleJumpGoomba(uiStore);
    },
  },
  "game-over": {
    mapping: {
      keyboard: {
        " ": "restart",
      },
      gamepad: {
        cross: "restart",
      },
      touch: {
        tap: "restart",
      },
    },
    onAction: (action) => {
      if (action === "restart") handleRestartGame();
    },
  },
  idle: {
    mapping: {
      keyboard: {
        " ": "start",
      },
      gamepad: {
        cross: "start",
      },
      touch: {
        tap: "start",
      },
    },
    onAction: (action) => {
      if (action === "start") handleStartGame();
    },
  },
};

// Create controls with keyboard disabled initially — canvas target is set on mount via remap
const { remapControlsOptions, destroyControls } = createControls({ ...bindings["idle"], keyboard: false });

const getBindingsWithTarget = (key: string) => ({
  ...bindings[key],
  keyboardTarget: canvas.value as unknown as HTMLCanvasElement | null,
});

const focusCanvas = () => {
  (canvas.value as unknown as HTMLCanvasElement)?.focus();
};

const handleStartGame = async () => {
  setStatus("playing");
  setScore(0);
  remapControlsOptions(getBindingsWithTarget("playing"));
  focusCanvas();
};

const handleRestartGame = () => {
  handleStartGame();
  shouldClearObstacles.value = true;
  remapControlsOptions(getBindingsWithTarget("playing"));
};

const endGame = () => {
  stopMusic();
  checkHighScore();
  setStatus("game-over");
  remapControlsOptions(getBindingsWithTarget("game-over"));
};

const { setSceneElements, clearSceneElements } = useDebugSceneStore();
const elementPropertiesStore = useElementPropertiesStore();
const { unregisterElementProperties, clearAllElementProperties } = elementPropertiesStore;
const textureStore = useTextureGroupsStore();

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  stats.init(route, statsElement);
  const createScene = async () => {
    initializeAudio();
    const { animate, setup, world, scene, getDelta, camera } = await getTools({
      stats,
      route,
      canvas,
    });
    remapControlsOptions(getBindingsWithTarget("idle"));
    const { elements, orbit } = await setup({
      config: setupConfig,
    });

    if (orbit) {
      orbit.target.y = 35;
      orbit.update();
    }
    registerCameraPropertiesUtility({ camera, orbit });

    const elementVisibility = new Map<string, boolean>();

    let sceneHandlers: { onToggleVisibility: (name: string) => void; onRemove: (name: string) => void } = { onToggleVisibility: () => {}, onRemove: () => {} };

    const textureAreaNames = new Set(config.backgrounds.textureAreaLayers.map(l => l.name));
    // Names hidden from the elements panel (ephemeral backgrounds, grouped areas)
    const hiddenFromPanel = new Set([...textureAreaNames, 'fire']);
    const textureAreaGroups = Object.fromEntries(
      [...textureAreaNames].map(name => [name, name.charAt(0).toUpperCase() + name.slice(1)])
    );

    const refreshElements = () => {
      const groupEntries = [...textureAreaNames].map(groupName => ({
        name: groupName,
        type: 'TextureArea',
        hidden: elementVisibility.get(groupName) ?? false,
        groupId: groupName,
      }));

      // Deduplicate scene children — show one entry per unique name, skip hidden/grouped/unnamed elements
      const seenNames = new Set<string>();
      const uniqueChildren = scene.children
        .filter(child => {
          if (!child.name) return false;
          if (hiddenFromPanel.has(child.name)) return false;
          if (seenNames.has(child.name)) return false;
          seenNames.add(child.name);
          return true;
        })
        .map(child => ({
          name: child.name || child.type,
          type: child.type,
          hidden: elementVisibility.get(child.name || child.type) ?? false,
        }));

      setSceneElements(
        [
          { name: 'Camera', type: camera.type, hidden: false },
          ...uniqueChildren,
          ...groupEntries,
        ],
        sceneHandlers,
        textureAreaGroups
      );
    };

    sceneHandlers = {
      onToggleVisibility: (name: string) => {
        if (textureAreaNames.has(name)) {
          const isHidden = elementVisibility.get(name) ?? false;
          scene.children.filter(c => c.name === name).forEach(m => { m.visible = isHidden; });
          elementVisibility.set(name, !isHidden);
        } else {
          const object = scene.getObjectByName(name);
          if (!object) return;
          object.visible = !object.visible;
          elementVisibility.set(name, !object.visible);
        }
        refreshElements();
      },
      onRemove: (name: string) => {
        if (textureAreaNames.has(name)) {
          scene.children.filter(c => c.name === name).forEach(m => scene.remove(m));
          elementVisibility.delete(name);
        } else {
          const object = scene.getObjectByName(name);
          if (object) scene.remove(object);
          elementVisibility.delete(name);
          unregisterElementProperties(name);
        }
        refreshElements();
      },
    };

    // Register light properties using shared utility
    const ambientLight = elements.find(e => e.name === 'ambient-light') as unknown as LightObject | undefined;
    if (ambientLight) registerLightProperties({ light: ambientLight, name: 'ambient-light', title: 'Ambient Light' });

    const directionalLight = elements.find(e => e.name === 'directional-light') as unknown as LightObject | undefined;
    if (directionalLight) registerLightProperties({ light: directionalLight, name: 'directional-light', title: 'Directional Light' });

    // Register texture area groups in texture store for ElementGroup rendering
    textureStore.$patch({
      groups: [...textureAreaNames].map(areaName => {
        const layers = config.backgrounds.textureAreaLayers.filter(l => l.name === areaName);
        return {
          id: areaName,
          name: areaName.charAt(0).toUpperCase() + areaName.slice(1),
          textures: layers.map((layer, index) => ({
            id: `${areaName}-tex-${index}`,
            name: `${areaName}-${index}`,
            filename: `${areaName}-${index}`,
            url: layer.texture,
          })),
        };
      }),
    });

    textureStore.registerHandlers({
      onSelectGroup: (id) => elementPropertiesStore.openElementProperties(id),
      onToggleVisibility: (id) => sceneHandlers.onToggleVisibility(id),
      onRemoveGroup: (id) => sceneHandlers.onRemove(id),
      onRemoveTexture: () => {},
      onToggleWireframe: () => {},
      onAddTextureToGroup: () => {},
      onAddNewGroup: () => {},
      onManualUpdate: () => {},
      onAddElement: () => {},
    });

    // Create timeline and get regeneration function
    const { timelineManager, regenerateTextureArea } = await createTimeline({
      scene,
      getDelta,
      world,
      shouldClearObstacles,
      camera,
      uiStore,
      endGame,
      onReset: refreshElements,
    });

    // Debounced regeneration for property changes (same pattern as sceneView store)
    const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    const DEBOUNCE_DELAY = 150;
    const debouncedRegenerate = (areaName: string, callback: () => void) => {
      if (debounceTimers[areaName]) clearTimeout(debounceTimers[areaName]);
      debounceTimers[areaName] = setTimeout(() => {
        delete debounceTimers[areaName];
        callback();
      }, DEBOUNCE_DELAY);
    };

    // Build updated layer configs from reactive config for a given area
    const buildLayerConfigs = (areaName: string, areaConfig: Record<string, unknown>) => {
      const originalLayers = config.backgrounds.textureAreaLayers.filter(l => l.name === areaName);
      if (originalLayers.length === 0) return [];

      const area = areaConfig.area as { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
      const textures = areaConfig.textures as { baseSize: { x: number; y: number; z: number } };
      const instances = areaConfig.instances as { density: number; seed: number };
      const rendering = areaConfig.rendering as { opacity: number; speed: number };

      // Calculate delta from first layer to preserve per-layer offsets for center/size
      const firstOriginal = originalLayers[0];
      const centerDelta = [
        area.center.x - firstOriginal.center[0],
        area.center.y - firstOriginal.center[1],
        area.center.z - firstOriginal.center[2],
      ];
      const sizeDelta = [
        area.size.x - firstOriginal.size[0],
        area.size.y - firstOriginal.size[1],
        area.size.z - firstOriginal.size[2],
      ];

      return originalLayers.map(layer => ({
        ...layer,
        center: [
          layer.center[0] + centerDelta[0],
          layer.center[1] + centerDelta[1],
          layer.center[2] + centerDelta[2],
        ] as [number, number, number],
        size: [
          layer.size[0] + sizeDelta[0],
          layer.size[1] + sizeDelta[1],
          layer.size[2] + sizeDelta[2],
        ] as [number, number, number],
        baseSize: [textures.baseSize.x, textures.baseSize.y, textures.baseSize.z] as [number, number, number],
        density: instances.density,
        opacity: rendering.opacity,
        speed: rendering.speed,
      }));
    };

    // Register texture area properties using shared utility
    const areaConfigs = ref<Record<string, Record<string, unknown>>>({});
    [...textureAreaNames].forEach(areaName => {
      const layers = config.backgrounds.textureAreaLayers.filter(l => l.name === areaName);
      if (layers.length === 0) return;

      registerTextureAreaProperties({
        areaName,
        layers,
        schema: textureAreaControls,
        areaConfigs,
        onUpdate: (updatedAreaName, _path, _value) => {
          const areaConfig = areaConfigs.value[updatedAreaName];
          if (!areaConfig) return;

          debouncedRegenerate(updatedAreaName, () => {
            const layerConfigs = buildLayerConfigs(updatedAreaName, areaConfig);
            regenerateTextureArea(updatedAreaName, layerConfigs);
          });
        },
      });
    });

    animate({ timeline: timelineManager });
    refreshElements();
  };
  createScene();
};

let initInstance: () => void;
onMounted(() => {
  loadGoogleFont(
    "https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap",
    fontName
  );
  loadHighScore();
  prevents();
  registerViewConfig(route.name as string, reactiveConfig, configControls);
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsElement.value as unknown) as HTMLElement
    );
  };
  initInstance();
  // Focus canvas so keyboard controls are scoped to the game
  (canvas.value as unknown as HTMLCanvasElement)?.focus();
  window.addEventListener("resize", initInstance);
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  destroyControls();
  stopMusic();
  window.removeEventListener("resize", initInstance);
  clearSceneElements();
  clearAllElementProperties();
  textureStore.$reset();
  unregisterViewConfig(route.name as string);
});
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas" tabindex="0" style="position: relative; z-index: 0; outline: none"></canvas>
  <StartScreen v-if="isGameStart" @start="handleStartGame" />
  <GameOver v-if="isGameOver" @restart="handleRestartGame" />
  <ScoreDisplay v-if="isGamePlaying || isGameOver" />
</template>
