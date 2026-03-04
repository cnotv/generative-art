<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { generatedRoutes } from "@/config/router";
import { SidebarNav, ConfigPanel, DebugPanel, ElementsPanel, PanelContainer } from "@/components/panels";
import GlobalNavigation from "@/components/GlobalNavigation.vue";
import { usePanelsStore } from "@/stores/panels";

const router = useRouter();
const route = useRoute();

const panelsStore = usePanelsStore();
panelsStore.initRouteSync();
watch(
  () => panelsStore.activePanels.size > 0,
  (hasOpen) => {
    document.documentElement.classList.toggle('panels-open', hasOpen);
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("keydown", handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyPress);
});

const handleKeyPress = (event: KeyboardEvent) => {
  const { name, query } = router.currentRoute.value;
  const page =
    typeof name === "string"
      ? generatedRoutes.map((r) => r?.name).indexOf(name)
      : 0;

  switch (event.key) {
    case "PageDown": {
      const path = generatedRoutes[page + 1]?.path;
      if (page < generatedRoutes.length - 1) router.push({ query, path });
      break;
    }

    case "PageUp": {
      const path = generatedRoutes[page - 1]?.path;
      if (page > 0) router.push({ query, path });
      break;
    }

    case "Home": {
      toggleQuery("record");
      break;
    }

    case "End": {
      toggleQuery(["control", "stats"]);
      break;
    }

    default:
      break;
  }
};

const toggleQuery = (param: string | string[]) => {
  const { path, query } = router.currentRoute.value;
  const params = typeof param === "string" ? [param] : param;
  const newQuery = params.reduce(
    (acc, key) => ({ ...acc, [key]: query[key] === "true" ? undefined : "true" }),
    {}
  );
  router.push({ path, query: { ...query, ...newQuery } });
};

const isRecording = computed(() => !!route.query.record);

const handleStartRecording = (durationMs: number) => {
  const fps = 30;
  const totalFrames = Math.floor((durationMs / 1000) * fps);
  router.push({ query: { ...route.query, record: String(totalFrames) } });
};

const handleStopRecording = () => {
  const query = { ...route.query };
  delete query.record;
  router.push({ query });
};
</script>

<template>
  <RouterView />
  <GlobalNavigation />
  <PanelContainer side="left" />
  <PanelContainer side="right" />
  <SidebarNav />
  <ConfigPanel />
  <DebugPanel />
  <ElementsPanel
    :is-recording="isRecording"
    @start="handleStartRecording"
    @stop="handleStopRecording"
  />
</template>

<style>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: top 0.2s;
}

html.panels-open canvas,
html:has(.global-navigation:hover) canvas,
html:has(.global-navigation:focus-within) canvas {
  top: var(--nav-height);
}
</style>
