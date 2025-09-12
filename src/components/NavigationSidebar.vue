<script lang="ts" setup>
import { generatedRoutes } from "@/config/router";
</script>

<template>
  <div class="sidebar">
    <div class="sidebar__menu"></div>
    <div class="sidebar__content">
      <router-link
        v-for="route in generatedRoutes"
        :key="route.path"
        :to="route.path"
        class="sidebar__link"
        active-class="sidebar__link--active"
      >
        <span class="sidebar__link-text">{{ route.name }}</span>
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
}

.sidebar__link {
  color: white;
  text-decoration: none;
  font-size: 0.8em;
}

.sidebar__menu {
  width: 50px;
  height: 50px;
  position: absolute;
  left: -50px;
}
</style>
