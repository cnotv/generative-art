import { ref } from 'vue';

interface ViewPanelsConfig {
  showTextures: boolean;
  showConfig: boolean;
}

const viewPanels = ref<ViewPanelsConfig>({
  showTextures: false,
  showConfig: false,
});

export const useViewPanels = () => {
  const setViewPanels = (config: Partial<ViewPanelsConfig>) => {
    viewPanels.value = {
      showTextures: config.showTextures ?? false,
      showConfig: config.showConfig ?? false,
    };
  };

  const clearViewPanels = () => {
    viewPanels.value = {
      showTextures: false,
      showConfig: false,
    };
  };

  return {
    viewPanels,
    setViewPanels,
    clearViewPanels,
  };
};
