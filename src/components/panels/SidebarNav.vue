<script setup lang="ts">
import { generatedRoutes as generatedRoutesAll } from "@/config/router";
import GenericPanel from "./GenericPanel.vue";

const generatedRoutes = generatedRoutesAll.filter((route): route is NonNullable<typeof route> => {
  if (!route?.path) return false;
  const slashCount = (route.path.match(/\//g) || []).length;
  return slashCount <= 3;
});
</script>

<template>
  <GenericPanel
    panel-type="sidebar"
    side="left"
  >
    <div class="sidebar-nav__content flex flex-col gap-6">
      <nav class="sidebar-nav__links flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        <template v-for="(route, index) in generatedRoutes" :key="route.path">
          <div
            v-if="generatedRoutes[index - 1]?.group !== route.group"
            class="sidebar-nav__group mt-4 text-xs font-bold text-muted-foreground uppercase"
          >
            {{ route.group }}
          </div>
          <router-link
            :to="route.path"
            class="sidebar-nav__link text-sm hover:text-primary transition-colors"
            active-class="sidebar-nav__link--active text-primary font-medium"
          >
            {{ route.name }}
          </router-link>
        </template>
      </nav>
    </div>
  </GenericPanel>
</template>

<style scoped>
.sidebar-nav__content {
  height: 100%;
  overflow-x: hidden;
}

.sidebar-nav__links {
  overflow-x: hidden;
}
</style>
