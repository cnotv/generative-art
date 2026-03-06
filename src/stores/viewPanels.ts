import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ViewPanelsConfig {
  showConfig: boolean;
}

export const useViewPanelsStore = defineStore('viewPanels', () => {
  const viewPanels = ref<ViewPanelsConfig>({
    showConfig: false,
  });

  const setViewPanels = (config: Partial<ViewPanelsConfig>) => {
    viewPanels.value = {
      showConfig: config.showConfig ?? false,
    };
  };

  const clearViewPanels = () => {
    viewPanels.value = {
      showConfig: false,
    };
  };

  return { viewPanels, setViewPanels, clearViewPanels };
});
