<script lang="ts" setup>
import { generatedRoutes as generatedRoutesAll } from "@/config/router";
const generatedRoutes = generatedRoutesAll.filter((route) => {
  const slashCount = (route.path.match(/\//g) || []).length;
  return slashCount <= 3;
});
</script>

<template>
  <div class="sidebar">
    <div class="sidebar__menu"></div>
    <div class="sidebar__content">
      <router-link
        v-for="(route, index) in generatedRoutes"
        :key="route.path"
        :to="route.path"
        class="sidebar__link"
        active-class="sidebar__link--active"
      >
        <div
          class="sidebar__link__group"
          v-if="generatedRoutes[index - 1]?.group !== route.group"
        >
          {{ route.group }}
        </div>
        <span class="sidebar__link__text">{{ route.name }}</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  right: 0;
  background-color: black;
  transform: translateX(100%);
  transition: all 0.3s ease-in-out;
  z-index: 99999;
}

.sidebar:hover {
  transform: translateX(0);
}

.sidebar__content {
  height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 2em;
  overflow: auto;
}

.sidebar__link {
  color: white;
  text-decoration: none;
  font-size: 0.8em;
}

.sidebar__link__group {
  font-weight: bold;
}

.sidebar__link:not(:first-child) .sidebar__link__group {
  margin-top: 1em;
}

.sidebar__link__text {
  margin-left: 1em;
}

.sidebar__menu {
  width: 50px;
  height: 50px;
  position: absolute;
  left: -50px;
}
</style>
