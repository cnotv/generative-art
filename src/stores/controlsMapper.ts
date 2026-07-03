import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  assignBinding,
  removeBinding,
  createDefaultMapping,
  getDefaultSkinId,
  serializePreset,
  parsePreset,
  savePresets,
  loadPresets,
  saveMapping,
  loadMapping
} from '@webgamekit/controls'
import type {
  ControlDevice,
  ControlMapping,
  ControlPreset,
  ControlSkinId
} from '@webgamekit/controls'

interface LiveEvent {
  action: string
  trigger: string
  device: string
  type: 'action' | 'release'
  timestamp: number
}

const RECENT_EVENTS_LIMIT = 30
const DEFAULT_GAME_ID = 'default'

/**
 * Controls-mapper store scoped to a game id. Each id gets an isolated instance
 * with its own mapping, skin, presets and persistence, so per-game dialogs and
 * the standalone test view (default id) never share state.
 *
 * @param {string} [gameId] Game identifier for isolated state and storage
 * @param {ControlMapping} [defaultMapping] Fallback mapping when nothing is stored
 * @returns {ReturnType<ReturnType<typeof defineStore>>} The scoped store instance
 */
export const useControlsMapperStore = (gameId?: string, defaultMapping?: ControlMapping) => {
  const key = gameId ?? DEFAULT_GAME_ID
  return defineStore(`controlsMapper:${key}`, () => {
    const mapping = ref<ControlMapping>(
      loadMapping(key) ?? defaultMapping ?? createDefaultMapping()
    )
    const selectedSkin = ref<ControlSkinId>(getDefaultSkinId())
    const presets = ref<ControlPreset[]>(loadPresets(gameId))
    const liveActions = ref<string[]>([])
    const recentEvents = ref<LiveEvent[]>([])
    const lastDevice = ref('')
    const activeDevice = ref<ControlDevice>('keyboard')
    const capturing = ref(false)

    watch(mapping, (value) => saveMapping(key, value), { deep: true, flush: 'sync' })

    const setActiveDevice = (device: ControlDevice) => {
      activeDevice.value = device
    }

    const setCapturing = (value: boolean) => {
      capturing.value = value
    }

    const bindTrigger = (device: ControlDevice, trigger: string, action: string) => {
      mapping.value = assignBinding(mapping.value, device, trigger, action)
    }

    const clearTrigger = (device: ControlDevice, trigger: string) => {
      mapping.value = removeBinding(mapping.value, device, trigger)
    }

    const resetToDefaults = () => {
      mapping.value = createDefaultMapping()
      selectedSkin.value = getDefaultSkinId()
    }

    const selectSkin = (skin: ControlSkinId) => {
      selectedSkin.value = skin
    }

    const persist = () => {
      savePresets(presets.value, gameId)
    }

    const savePreset = (name: string) => {
      const preset: ControlPreset = { name, mapping: mapping.value, skin: selectedSkin.value }
      presets.value = [...presets.value.filter((entry) => entry.name !== name), preset]
      persist()
    }

    const applyPreset = (name: string) => {
      const preset = presets.value.find((entry) => entry.name === name)
      if (!preset) return
      mapping.value = preset.mapping
      selectedSkin.value = preset.skin
    }

    const deletePreset = (name: string) => {
      presets.value = presets.value.filter((entry) => entry.name !== name)
      persist()
    }

    const exportCurrent = (name: string): string =>
      serializePreset({ name, mapping: mapping.value, skin: selectedSkin.value })

    const importPreset = (json: string) => {
      const preset = parsePreset(json)
      mapping.value = preset.mapping
      selectedSkin.value = preset.skin
    }

    const recordAction = (action: string, trigger: string, device: string) => {
      if (capturing.value) return
      lastDevice.value = device
      if (!liveActions.value.includes(action)) {
        liveActions.value = [...liveActions.value, action]
      }
      recentEvents.value = [
        { action, trigger, device, type: 'action', timestamp: Date.now() },
        ...recentEvents.value
      ].slice(0, RECENT_EVENTS_LIMIT)
    }

    const recordRelease = (action: string) => {
      liveActions.value = liveActions.value.filter((entry) => entry !== action)
      recentEvents.value = [
        { action, trigger: '', device: '', type: 'release', timestamp: Date.now() },
        ...recentEvents.value
      ].slice(0, RECENT_EVENTS_LIMIT)
    }

    return {
      mapping,
      selectedSkin,
      presets,
      liveActions,
      recentEvents,
      lastDevice,
      activeDevice,
      setActiveDevice,
      capturing,
      setCapturing,
      bindTrigger,
      clearTrigger,
      resetToDefaults,
      selectSkin,
      savePreset,
      applyPreset,
      deletePreset,
      exportCurrent,
      importPreset,
      recordAction,
      recordRelease
    }
  })()
}
