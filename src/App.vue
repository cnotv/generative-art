<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useQueryStore } from "./stores/queryStore";
import { generatedRoutes } from "@/config/router";
import NavigationSidebar from "@/components/NavigationSidebar.vue";

const router = useRouter();
const route = useRoute();
const queryStore = useQueryStore();
queryStore.setQuery(route.query);

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
</script>

<template>
  <RouterView />
  <NavigationSidebar />
</template>

<style>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
