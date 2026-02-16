import { ref } from 'vue';

interface ViewPanelsConfig {
  showTextures: boolean;
  showConfig: boolean;
  showScene: boolean;
}

const viewPanels = ref<ViewPanelsConfig>({
  showTextures: false,
  showConfig: false,
  showScene: false,
});

export const useViewPanels = () => {
  const setViewPanels = (config: Partial<ViewPanelsConfig>) => {
    viewPanels.value = {
      showTextures: config.showTextures ?? false,
      showConfig: config.showConfig ?? false,
      showScene: config.showScene ?? false,
    };
  };

  const clearViewPanels = () => {
    viewPanels.value = {
      showTextures: false,
      showConfig: false,
      showScene: false,
    };
  };

  return {
    viewPanels,
    setViewPanels,
    clearViewPanels,
  };
};
