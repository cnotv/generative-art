<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useSceneViewStore } from "@/stores/sceneView";
import { presets } from "@/views/Tools/SceneEditor/config";
import cloudImageUrl from "@/assets/images/illustrations/cloud1.webp";
import treeImageUrl from "@/assets/images/illustrations/Tree1-1.webp";

const canvas = ref<HTMLCanvasElement | null>(null);
const store = useSceneViewStore();

onMounted(async () => {
  if (!canvas.value) return;

  await store.init(canvas.value, {
    camera: { position: [0, 5, 10], fov: 75 },
    ground: { color: 0x888888, size: [100, 0.1, 100] },
    lights: {
      ambient: { color: 0xffffff, intensity: 1 },
      directional: { color: 0xffffff, intensity: 2, position: [50, 100, 50] },
    },
    sky: { color: 0xaaaaff, size: 1000 },
  });

  store.initTextureGroups(
    [
      {
        id: "cloud",
        name: "Cloud",
        textures: [
          { id: "cloud-tex-1", name: "cloud1", filename: "cloud1", url: cloudImageUrl },
        ],
      },
      {
        id: "tree",
        name: "Tree",
        textures: [
          { id: "tree-tex-1", name: "Tree1-1", filename: "Tree1-1", url: treeImageUrl },
        ],
      },
    ],
    { cloud: "Cloud", tree: "Tree" },
    { cloud: presets.clouds.config, tree: presets.trees.config }
  );
});

onBeforeUnmount(() => store.cleanup());
</script>

<template>
  <div class="panels-test">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.panels-test {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
