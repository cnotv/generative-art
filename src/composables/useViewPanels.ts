import { ref } from 'vue';

interface ViewPanelsConfig {
  showConfig: boolean;
}

const viewPanels = ref<ViewPanelsConfig>({
  showConfig: false,
});

export const useViewPanels = () => {
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

  return {
    viewPanels,
    setViewPanels,
    clearViewPanels,
  };
};
