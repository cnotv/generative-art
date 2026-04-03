import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ViewPanelsConfig {
  showConfig: boolean
  showElements: boolean
}

export const useViewPanelsStore = defineStore('viewPanels', () => {
  const viewPanels = ref<ViewPanelsConfig>({
    showConfig: false,
    showElements: true
  })

  const setViewPanels = (config: Partial<ViewPanelsConfig>) => {
    viewPanels.value = {
      showConfig: config.showConfig ?? false,
      showElements: config.showElements ?? true
    }
  }

  const clearViewPanels = () => {
    viewPanels.value = {
      showConfig: false,
      showElements: true
    }
  }

  return { viewPanels, setViewPanels, clearViewPanels }
})
