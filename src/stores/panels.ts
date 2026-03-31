import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export type PanelType = 'navigation' | 'config' | 'scene' | 'debug' | 'elements'

const ALL_PANEL_TYPES: PanelType[] = ['navigation', 'config', 'scene', 'debug', 'elements']

// Panels stacked from edge inward; index 0 = closest to viewport edge
const RIGHT_PANEL_ORDER: PanelType[] = ['debug', 'scene', 'config']
const LEFT_PANEL_ORDER: PanelType[] = ['elements']

export const usePanelsStore = defineStore('panels', () => {
  const activePanels = ref<Set<PanelType>>(new Set())
  const syncInitialized = ref(false)

  // Captured once from initRouteSync (called in App.vue setup context).
  // useRouter/useRoute cannot be called outside component setup, so we store refs here.
  let _router: ReturnType<typeof useRouter> | null = null
  let _route: ReturnType<typeof useRoute> | null = null

  const isNavigationOpen = computed(() => activePanels.value.has('navigation'))
  const isConfigOpen = computed(() => activePanels.value.has('config'))
  const isDebugOpen = computed(() => activePanels.value.has('debug'))
  const isSceneOpen = computed(() => activePanels.value.has('scene'))

  // Returns the number of open panels stacked closer to the viewport edge on the same side.
  // Used to offset panels so they appear side-by-side instead of overlapping.
  const getPanelOffset = (panelType: PanelType): number => {
    const rightIndex = RIGHT_PANEL_ORDER.indexOf(panelType)
    if (rightIndex !== -1) {
      return RIGHT_PANEL_ORDER.slice(0, rightIndex).filter((p) => activePanels.value.has(p)).length
    }
    const leftIndex = LEFT_PANEL_ORDER.indexOf(panelType)
    if (leftIndex !== -1) {
      return LEFT_PANEL_ORDER.slice(0, leftIndex).filter((p) => activePanels.value.has(p)).length
    }
    return 0
  }

  const withMutualExclusion = (panel: PanelType, current: Set<PanelType>): Set<PanelType> => {
    if (panel === 'navigation') return new Set(['navigation'])
    return new Set([...[...current].filter((p) => p !== 'navigation'), panel])
  }

  const syncToQuery = () => {
    if (!_router || !_route) return
    const { path, query } = _route
    const panelQuery = ALL_PANEL_TYPES.reduce<Record<string, string | undefined>>(
      (accumulator, panel) => ({
        ...accumulator,
        [panel]: activePanels.value.has(panel) ? 'true' : undefined
      }),
      {}
    )
    _router.push({ path, query: { ...query, ...panelQuery } })
  }

  // Call once from App.vue to sync store state with URL query params.
  // Uses useRoute/useRouter which require a component context — must be called from a component setup.
  const initRouteSync = () => {
    if (syncInitialized.value) return
    syncInitialized.value = true

    _router = useRouter()
    _route = useRoute()

    const initialOpen = ALL_PANEL_TYPES.filter(
      (panel) => _route!.query[panel] === 'true' && !activePanels.value.has(panel)
    )
    if (initialOpen.length > 0) {
      activePanels.value = new Set([...activePanels.value, ...initialOpen])
    }

    ALL_PANEL_TYPES.forEach((panel) => {
      watch(
        () => _route!.query[panel],
        (value) => {
          const isOpen = activePanels.value.has(panel)
          if (value === 'true' && !isOpen) {
            activePanels.value = new Set([...activePanels.value, panel])
          } else if (value !== 'true' && isOpen) {
            activePanels.value = new Set([...activePanels.value].filter((p) => p !== panel))
          }
        }
      )
    })
  }

  const openPanel = (panel: PanelType) => {
    activePanels.value = withMutualExclusion(panel, activePanels.value)
    syncToQuery()
  }

  const closePanel = (panel: PanelType) => {
    activePanels.value = new Set([...activePanels.value].filter((p) => p !== panel))
    syncToQuery()
  }

  const togglePanel = (panel: PanelType) => {
    activePanels.value = activePanels.value.has(panel)
      ? new Set([...activePanels.value].filter((p) => p !== panel))
      : withMutualExclusion(panel, activePanels.value)
    syncToQuery()
  }

  const closeAllPanels = () => {
    activePanels.value = new Set()
    syncToQuery()
  }

  const resetState = () => {
    activePanels.value = new Set()
    syncInitialized.value = false
    _router = null
    _route = null
  }

  return {
    activePanels,
    syncInitialized,
    isNavigationOpen,
    isConfigOpen,
    isDebugOpen,
    isSceneOpen,
    getPanelOffset,
    initRouteSync,
    openPanel,
    closePanel,
    togglePanel,
    closeAllPanels,
    resetState
  }
})
