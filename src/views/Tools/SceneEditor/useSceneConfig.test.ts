import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SCENE_DEFAULTS } from '@webgamekit/threejs'
import { useSceneConfig, _resetSceneConfig } from './useSceneConfig'

const makeHandlers = () => ({
  onGroundUpdate: vi.fn(),
  onLightsUpdate: vi.fn(),
  onSkyUpdate: vi.fn(),
  onCleanup: vi.fn()
})

describe('useSceneConfig', () => {
  beforeEach(() => {
    _resetSceneConfig()
  })

  describe('default ground config matches SCENE_DEFAULTS', () => {
    it.each([
      ['enabled', true],
      ['color', SCENE_DEFAULTS.ground.color],
      ['size', SCENE_DEFAULTS.ground.size]
    ] as const)('groundConfig.%s defaults to %j', (field, expected) => {
      const { groundConfig } = useSceneConfig()
      expect(groundConfig.value[field]).toEqual(expected)
    })
  })

  describe('default lights config matches SCENE_DEFAULTS', () => {
    it.each([
      ['ambient.color', SCENE_DEFAULTS.lights.ambient.color],
      ['ambient.intensity', SCENE_DEFAULTS.lights.ambient.intensity],
      ['directional.color', SCENE_DEFAULTS.lights.directional.color],
      ['directional.intensity', SCENE_DEFAULTS.lights.directional.intensity],
      ['directional.position', SCENE_DEFAULTS.lights.directional.position]
    ])('lightsConfig.%s defaults to %j', (path, expected) => {
      const { lightsConfig } = useSceneConfig()
      const [group, field] = path.split('.') as [keyof typeof lightsConfig.value, string]
      const groupValue = lightsConfig.value[group] as Record<string, unknown>
      expect(groupValue[field]).toEqual(expected)
    })
  })

  describe('default sky config matches SCENE_DEFAULTS', () => {
    it.each([
      ['enabled', true],
      ['color', SCENE_DEFAULTS.sky.color],
      ['size', SCENE_DEFAULTS.sky.size]
    ] as const)('skyConfig.%s defaults to %j', (field, expected) => {
      const { skyConfig } = useSceneConfig()
      expect(skyConfig.value[field]).toEqual(expected)
    })
  })

  describe('updateGroundField', () => {
    it('updates the reactive ref', () => {
      const { groundConfig, updateGroundField } = useSceneConfig()
      updateGroundField('color', 0xff0000)
      expect(groundConfig.value.color).toBe(0xff0000)
    })

    it('calls onGroundUpdate handler with field and value', () => {
      const handlers = makeHandlers()
      const { registerSceneHandlers, updateGroundField } = useSceneConfig()
      registerSceneHandlers(handlers)
      updateGroundField('enabled', false)
      expect(handlers.onGroundUpdate).toHaveBeenCalledWith('enabled', false)
    })

    it.each([
      ['color', 0x123456],
      ['enabled', false]
    ] as const)('updates ground.%s to %j', (field, value) => {
      const { groundConfig, updateGroundField } = useSceneConfig()
      updateGroundField(field, value)
      expect(groundConfig.value[field]).toEqual(value)
    })
  })

  describe('updateLightsField', () => {
    it('updates nested ambient field via dot-path', () => {
      const { lightsConfig, updateLightsField } = useSceneConfig()
      updateLightsField('ambient.intensity', 5)
      expect(lightsConfig.value.ambient.intensity).toBe(5)
    })

    it('updates nested directional field via dot-path', () => {
      const { lightsConfig, updateLightsField } = useSceneConfig()
      updateLightsField('directional.color', 0xaabbcc)
      expect(lightsConfig.value.directional.color).toBe(0xaabbcc)
    })

    it('calls onLightsUpdate handler with path and value', () => {
      const handlers = makeHandlers()
      const { registerSceneHandlers, updateLightsField } = useSceneConfig()
      registerSceneHandlers(handlers)
      updateLightsField('ambient.intensity', 3)
      expect(handlers.onLightsUpdate).toHaveBeenCalledWith('ambient.intensity', 3)
    })

    it.each([
      ['ambient.color', 0xffffff],
      ['ambient.intensity', 4],
      ['directional.intensity', 8]
    ])('updates lights.%s to %j', (path, value) => {
      const { lightsConfig, updateLightsField } = useSceneConfig()
      updateLightsField(path, value)
      const [group, field] = path.split('.') as [keyof typeof lightsConfig.value, string]
      const groupValue = lightsConfig.value[group] as Record<string, unknown>
      expect(groupValue[field]).toBe(value)
    })
  })

  describe('updateSkyField', () => {
    it('updates the reactive ref', () => {
      const { skyConfig, updateSkyField } = useSceneConfig()
      updateSkyField('color', 0x0000ff)
      expect(skyConfig.value.color).toBe(0x0000ff)
    })

    it('calls onSkyUpdate handler with field and value', () => {
      const handlers = makeHandlers()
      const { registerSceneHandlers, updateSkyField } = useSceneConfig()
      registerSceneHandlers(handlers)
      updateSkyField('size', 2000)
      expect(handlers.onSkyUpdate).toHaveBeenCalledWith('size', 2000)
    })

    it.each([
      ['color', 0x334455],
      ['enabled', false],
      ['size', 500]
    ] as const)('updates sky.%s to %j', (field, value) => {
      const { skyConfig, updateSkyField } = useSceneConfig()
      updateSkyField(field, value)
      expect(skyConfig.value[field]).toEqual(value)
    })
  })

  describe('unregisterSceneHandlers', () => {
    it('calls onCleanup and resets all configs to defaults', () => {
      const handlers = makeHandlers()
      const { registerSceneHandlers, unregisterSceneHandlers, groundConfig, skyConfig } =
        useSceneConfig()
      registerSceneHandlers(handlers)

      const { updateGroundField, updateSkyField } = useSceneConfig()
      updateGroundField('color', 0xabcdef)
      updateSkyField('size', 999)

      unregisterSceneHandlers()

      expect(handlers.onCleanup).toHaveBeenCalledTimes(1)
      expect(groundConfig.value.color).toBe(SCENE_DEFAULTS.ground.color)
      expect(skyConfig.value.size).toBe(SCENE_DEFAULTS.sky.size)
    })

    it('does not call handler after unregistration', () => {
      const handlers = makeHandlers()
      const { registerSceneHandlers, unregisterSceneHandlers, updateGroundField } = useSceneConfig()
      registerSceneHandlers(handlers)
      unregisterSceneHandlers()
      updateGroundField('color', 0xff0000)
      expect(handlers.onGroundUpdate).not.toHaveBeenCalled()
    })
  })

  describe('_resetSceneConfig', () => {
    it('restores all defaults after updates', () => {
      const {
        groundConfig,
        lightsConfig,
        skyConfig,
        updateGroundField,
        updateLightsField,
        updateSkyField
      } = useSceneConfig()
      updateGroundField('color', 0x111111)
      updateLightsField('ambient.intensity', 9)
      updateSkyField('size', 2000)

      _resetSceneConfig()

      expect(groundConfig.value.color).toBe(SCENE_DEFAULTS.ground.color)
      expect(lightsConfig.value.ambient.intensity).toBe(SCENE_DEFAULTS.lights.ambient.intensity)
      expect(skyConfig.value.size).toBe(SCENE_DEFAULTS.sky.size)
    })
  })
})
