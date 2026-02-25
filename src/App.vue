<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useQueryStore } from "./stores/queryStore";
import { generatedRoutes } from "@/config/router";
import { SidebarNav, ConfigPanel, ScenePanel, DebugPanel, CameraPanel, PanelContainer } from "@/components/panels";
import GlobalNavigation from "@/components/GlobalNavigation.vue";
import { usePanels } from "@/composables/usePanels";

const router = useRouter();
const route = useRoute();
const queryStore = useQueryStore();
queryStore.setQuery(route.query);

const { activePanels } = usePanels();
watch(
  () => activePanels.value.size > 0,
  (hasOpen) => {
    document.documentElement.style.setProperty(
      '--canvas-top',
      hasOpen ? 'var(--nav-height)' : '0px'
    );
  },
  { immediate: true }
);

// Watch for changes in the router query and update the store
watch(
  () => route.query,
  (newQuery) => {
    queryStore.setQuery(newQuery);
  }
);

// Watch for changes in the store and update the router query
watch(
  () => queryStore.query,
  (newQuery) => {
    router.push({ query: newQuery });
  },
  { deep: true }
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
      ? generatedRoutes.map((route) => route.name).indexOf(name)
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
  queryStore.setQuery(newQuery);
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
  <ScenePanel />
  <CameraPanel
    :is-recording="isRecording"
    @start="handleStartRecording"
    @stop="handleStopRecording"
  />
  <DebugPanel />
</template>

<style>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: var(--canvas-top, 0px);
  left: 0;
}
</style>
