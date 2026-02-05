<script setup lang="ts">
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { Menu } from 'lucide-vue-next';
import { generatedRoutes as generatedRoutesAll } from '@/config/router';

const { isSidebarOpen, togglePanel, closePanel } = usePanels();

const generatedRoutes = generatedRoutesAll.filter((route) => {
  const slashCount = (route.path.match(/\//g) || []).length;
  return slashCount <= 3;
});

const handleToggle = () => {
  togglePanel('sidebar');
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};
</script>

<template>
  <div class="sidebar-nav">
    <Button
      variant="ghost"
      size="icon"
      class="sidebar-nav__trigger fixed left-4 top-4 z-40 opacity-0 hover:opacity-100 hover:bg-black/70 transition-opacity"
      @click="handleToggle"
    >
      <Menu class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isSidebarOpen" side="left" @update:open="handleOpenChange">
      <div class="sidebar-nav__content flex flex-col gap-6">
        <h2 class="text-lg font-semibold shrink-0">Navigation</h2>

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
    </Sheet>
  </div>
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
