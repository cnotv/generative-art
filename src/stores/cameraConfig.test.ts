import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { CameraPreset } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { useCameraConfigStore } from './cameraConfig'

const makeHandlers = () => ({
  onPresetChange: vi.fn(),
  onSlotActivate: vi.fn(),
  onCleanup: vi.fn()
})

const makeSlot = (id: string, label: string, preset = CameraPreset.Perspective) => ({
  id,
  label,
  preset,
  position: [0, 50, 100] as CoordinateTuple,
  fov: 60
})

describe('useCameraConfigStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('registerCameraHandlers', () => {
    it('populates slots and sets activeSlotId to first slot', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()
      const slot = makeSlot('cam-1', 'Camera 1')

      store.registerCameraHandlers([slot], handlers)
      await nextTick()

      expect(store.cameraSlots).toHaveLength(1)
      expect(store.cameraSlots[0]).toEqual(slot)
      expect(store.activeSlotId).toBe('cam-1')
    })

    it('handles empty slots array — activeSlotId is null', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers([], makeHandlers())
      await nextTick()

      expect(store.cameraSlots).toHaveLength(0)
      expect(store.activeSlotId).toBeNull()
    })

    it('sets activeSlotId to first slot when multiple slots provided', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2', CameraPreset.Fisheye)],
        makeHandlers()
      )
      await nextTick()

      expect(store.activeSlotId).toBe('cam-1')
    })
  })

  describe('unregisterCameraHandlers', () => {
    it('calls onCleanup once and restores default slot', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers)
      store.unregisterCameraHandlers()
      await nextTick()

      expect(handlers.onCleanup).toHaveBeenCalledTimes(1)
      expect(store.cameraSlots).toHaveLength(1)
      expect(store.activeSlotId).toBe('cam-default')
    })

    it('does not throw when called before register', () => {
      const store = useCameraConfigStore()
      expect(() => store.unregisterCameraHandlers()).not.toThrow()
    })
  })

  describe('addCameraSlot', () => {
    it.each([
      [1, 'Camera 2'],
      [2, 'Camera 3'],
      [3, 'Camera 4']
    ])(
      'appends slot with label "Camera N" when %d slots already exist',
      async (existingCount, expectedLabel) => {
        const store = useCameraConfigStore()
        const slots = Array.from({ length: existingCount }, (_, i) =>
          makeSlot(`cam-${i + 1}`, `Camera ${i + 1}`)
        )

        store.registerCameraHandlers(slots, makeHandlers())
        store.addCameraSlot()
        await nextTick()

        const newSlot = store.cameraSlots[store.cameraSlots.length - 1]
        expect(newSlot.label).toBe(expectedLabel)
        expect(store.cameraSlots).toHaveLength(existingCount + 1)
      }
    )

    it('new slot has a unique id', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers())
      store.addCameraSlot()
      await nextTick()

      const ids = store.cameraSlots.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('removeCameraSlot', () => {
    it('removes the specified slot', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      )
      store.removeCameraSlot('cam-2')
      await nextTick()

      expect(store.cameraSlots).toHaveLength(1)
      expect(store.cameraSlots[0].id).toBe('cam-1')
    })

    it('activates first remaining slot and calls onSlotActivate when active slot is removed', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      )

      store.removeCameraSlot('cam-1')
      await nextTick()

      expect(store.activeSlotId).toBe('cam-2')
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2')
    })

    it('does not call onSlotActivate when a non-active slot is removed', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      )

      store.removeCameraSlot('cam-2')
      await nextTick()

      expect(handlers.onSlotActivate).not.toHaveBeenCalled()
    })

    it('does not crash when removing a nonexistent id', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers())
      expect(() => store.removeCameraSlot('nonexistent')).not.toThrow()
      await nextTick()

      expect(store.cameraSlots).toHaveLength(1)
    })
  })

  describe('renameCameraSlot', () => {
    it.each([
      ['New Name'],
      ['Camera Updated'],
      [''],
      ['A very long camera name that describes the view in detail']
    ])('renames slot label to "%s"', async (newLabel) => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers())
      store.renameCameraSlot('cam-1', newLabel)
      await nextTick()

      expect(store.cameraSlots[0].label).toBe(newLabel)
    })

    it('only renames the targeted slot', async () => {
      const store = useCameraConfigStore()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      )
      store.renameCameraSlot('cam-1', 'Renamed')
      await nextTick()

      expect(store.cameraSlots[0].label).toBe('Renamed')
      expect(store.cameraSlots[1].label).toBe('Camera 2')
    })
  })

  describe('activateCameraSlot', () => {
    it('updates activeSlotId and calls onSlotActivate', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      )

      store.activateCameraSlot('cam-2')
      await nextTick()

      expect(store.activeSlotId).toBe('cam-2')
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2')
    })

    it('calls onSlotActivate with the correct id', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers(
        [
          makeSlot('cam-1', 'Camera 1'),
          makeSlot('cam-2', 'Camera 2'),
          makeSlot('cam-3', 'Camera 3')
        ],
        handlers
      )

      store.activateCameraSlot('cam-3')
      await nextTick()

      expect(handlers.onSlotActivate).toHaveBeenCalledTimes(1)
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-3')
    })
  })

  describe('applyPresetToActiveSlot', () => {
    it.each(Object.values(CameraPreset))(
      'applies preset "%s" to active slot and calls onPresetChange',
      async (preset) => {
        const store = useCameraConfigStore()
        const handlers = makeHandlers()

        store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers)
        store.applyPresetToActiveSlot(preset)
        await nextTick()

        expect(store.activeSlot?.preset).toBe(preset)
        expect(handlers.onPresetChange).toHaveBeenCalledWith('cam-1', preset)
      }
    )

    it('is a no-op and does not call onPresetChange when activeSlotId is null', async () => {
      const store = useCameraConfigStore()
      const handlers = makeHandlers()

      store.registerCameraHandlers([], handlers)
      store.applyPresetToActiveSlot(CameraPreset.Perspective)
      await nextTick()

      expect(handlers.onPresetChange).not.toHaveBeenCalled()
    })
  })

  describe('syncActiveSlotPosition', () => {
    it('updates position in store without calling onUpdate', async () => {
      const store = useCameraConfigStore()
      const handlers = { ...makeHandlers(), onUpdate: vi.fn() }

      store.registerCameraHandlers(
        [{ ...makeSlot('cam-1', 'Camera 1'), orbitTarget: [0, 0, 0] as CoordinateTuple }],
        handlers
      )
      store.syncActiveSlotPosition([10, 20, 30])
      await nextTick()

      expect(store.activeSlot?.position).toEqual([10, 20, 30])
      expect(handlers.onUpdate).not.toHaveBeenCalled()
    })
  })

  describe('syncActiveSlotOrbitTarget', () => {
    it('updates orbitTarget in store without calling onUpdate', async () => {
      const store = useCameraConfigStore()
      const handlers = { ...makeHandlers(), onUpdate: vi.fn() }

      store.registerCameraHandlers(
        [{ ...makeSlot('cam-1', 'Camera 1'), orbitTarget: [0, 0, 0] as CoordinateTuple }],
        handlers
      )
      store.syncActiveSlotOrbitTarget([5, 10, 15])
      await nextTick()

      expect(store.activeSlot?.orbitTarget).toEqual([5, 10, 15])
      expect(handlers.onUpdate).not.toHaveBeenCalled()
    })

    it('is a no-op when activeSlotId is null', async () => {
      const store = useCameraConfigStore()
      store.registerCameraHandlers([], makeHandlers())
      store.syncActiveSlotOrbitTarget([1, 2, 3])
      await nextTick()

      expect(store.cameraSlots).toHaveLength(0)
    })
  })

  describe('activeSlot computed', () => {
    it('returns the slot matching activeSlotId', async () => {
      const store = useCameraConfigStore()
      const slot2 = makeSlot('cam-2', 'Camera 2', CameraPreset.TopDown)

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1'), slot2], makeHandlers())
      store.activateCameraSlot('cam-2')
      await nextTick()

      expect(store.activeSlot).toEqual(slot2)
    })

    it('returns the default slot on init', () => {
      const store = useCameraConfigStore()
      expect(store.activeSlot).not.toBeNull()
      expect(store.activeSlot?.id).toBe('cam-default')
    })
  })

  describe('follow views', () => {
    const FOLLOW_VIEWS = [
      { value: 'third', label: 'Third Person' },
      { value: 'first', label: 'First Person' },
      { value: 'free', label: 'Free Chase' }
    ]

    const registerRig = (store: ReturnType<typeof useCameraConfigStore>) => {
      const onChange = vi.fn()
      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers())
      store.registerFollowViews(FOLLOW_VIEWS, 'third', onChange)
      return onChange
    }

    it('offers a rig its views on the camera panel', () => {
      const store = useCameraConfigStore()
      registerRig(store)

      expect(store.followViews).toEqual(FOLLOW_VIEWS)
      expect(store.activeFollowView).toBe('third')
    })

    it.each(FOLLOW_VIEWS)('hands $value back to the rig when picked', ({ value }) => {
      const store = useCameraConfigStore()
      const onChange = registerRig(store)

      store.selectFollowView(value)

      expect(onChange).toHaveBeenCalledWith(value)
    })

    it('releases the rig when a preset is applied, so the preset survives the next frame', () => {
      const store = useCameraConfigStore()
      const onChange = registerRig(store)

      store.applyPresetToActiveSlot(CameraPreset.TopDown)

      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('releases the rig when the camera is rotated, so the rotation survives', () => {
      const store = useCameraConfigStore()
      const onChange = registerRig(store)

      store.rotateActiveSlot(45)

      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('does not keep releasing a rig that is already released', () => {
      const store = useCameraConfigStore()
      const onChange = registerRig(store)

      store.setActiveFollowView(null)
      store.rotateActiveSlot(45)
      store.applyPresetToActiveSlot(CameraPreset.TopDown)

      expect(onChange).not.toHaveBeenCalled()
    })

    it('picks the only target for the player, since there is nothing to choose', () => {
      const store = useCameraConfigStore()
      const onChange = vi.fn()

      store.registerFollowTargets([{ value: 'player', label: 'player' }], onChange)

      expect(store.activeFollowTarget).toBe('player')
      expect(onChange).toHaveBeenCalledWith('player')
    })

    it('leaves the choice open when there is more than one', () => {
      const store = useCameraConfigStore()

      store.registerFollowTargets(
        [
          { value: 'player', label: 'player' },
          { value: 'crate', label: 'crate' }
        ],
        vi.fn()
      )

      expect(store.activeFollowTarget).toBeNull()
    })

    it('keeps a chosen target when the list is republished', () => {
      // The list is rebuilt whenever the scene changes, which must not undo a deliberate pick.
      const store = useCameraConfigStore()
      const targets = [
        { value: 'player', label: 'player' },
        { value: 'crate', label: 'crate' }
      ]
      store.registerFollowTargets(targets, vi.fn())
      store.setFollowTarget('crate')

      store.registerFollowTargets(targets, vi.fn())

      expect(store.activeFollowTarget).toBe('crate')
    })

    it('starts on the target a scene names, among several', () => {
      const store = useCameraConfigStore()
      const targets = [
        { value: 'player', label: 'player' },
        { value: 'landmark', label: 'landmark' }
      ]

      store.registerFollowTargets(targets, vi.fn(), 'player')

      expect(store.activeFollowTarget).toBe('player')
    })

    it('ignores a named target that is not in the scene', () => {
      const store = useCameraConfigStore()

      store.registerFollowTargets([{ value: 'player', label: 'player' }], vi.fn(), 'missing')

      expect(store.activeFollowTarget).toBe('player')
    })

    it('drops a target that has left the scene', () => {
      const store = useCameraConfigStore()
      store.registerFollowTargets([{ value: 'crate', label: 'crate' }], vi.fn())

      store.registerFollowTargets([{ value: 'player', label: 'player' }], vi.fn())

      expect(store.activeFollowTarget).toBe('player')
    })

    it('resets to the scene default and lets go of the rig, so the framing holds', () => {
      const store = useCameraConfigStore()
      const onResetToSceneDefault = vi.fn(() => 'perspective' as const)
      const onChange = registerRig(store)
      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], {
        ...makeHandlers(),
        onResetToSceneDefault
      })
      store.registerFollowViews(FOLLOW_VIEWS, 'third', onChange)

      store.resetCameraToSceneDefault()

      expect(onChange).toHaveBeenCalledWith(null)
      expect(onResetToSceneDefault).toHaveBeenCalled()
    })

    it.each([
      { restored: 'orthographic' as const, preset: CameraPreset.Orthographic },
      { restored: 'perspective' as const, preset: CameraPreset.Perspective }
    ])('shows the $restored preset after resetting to it', ({ restored, preset }) => {
      // The panel has to agree with the camera: a reset that puts the projection back while the
      // toggle still reads the other one is the same lie as not resetting at all.
      const store = useCameraConfigStore()
      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1', CameraPreset.TopDown)], {
        ...makeHandlers(),
        onResetToSceneDefault: () => restored
      })

      store.resetCameraToSceneDefault()

      expect(store.activeSlot?.preset).toBe(preset)
    })

    it('does not re-apply a preset while resetting, which would move the camera again', () => {
      const store = useCameraConfigStore()
      const handlers = { ...makeHandlers(), onResetToSceneDefault: () => 'perspective' as const }
      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers)

      store.resetCameraToSceneDefault()

      expect(handlers.onPresetChange).not.toHaveBeenCalled()
    })

    it('puts the follow offsets back to what the scene asked for', () => {
      // A dragged height is a camera setting like any other: left behind, the next follow view
      // is framed by whatever was last fiddled with rather than by the scene.
      const store = useCameraConfigStore()
      const onFollowReset = vi.fn()
      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], {
        ...makeHandlers(),
        onResetToSceneDefault: () => 'perspective' as const
      })
      store.registerFollowReset(onFollowReset)

      store.resetCameraToSceneDefault()

      expect(onFollowReset).toHaveBeenCalled()
    })

    it('forgets how to reset the offsets once the rig is gone', () => {
      const store = useCameraConfigStore()
      const onFollowReset = vi.fn()
      store.registerFollowReset(onFollowReset)

      store.unregisterFollowViews()
      store.resetCameraToSceneDefault()

      expect(onFollowReset).not.toHaveBeenCalled()
    })

    it.each([
      { key: 'thirdPersonHeight' as const, value: 12 },
      { key: 'followRotation' as const, value: false }
    ])('writes $key, whether it is a number or a switch', ({ key, value }) => {
      const store = useCameraConfigStore()

      store.updateFollowSetting(key, value)

      expect(store.followConfig[key]).toBe(value)
    })

    it('forgets the views once the rig is gone', () => {
      const store = useCameraConfigStore()
      registerRig(store)

      store.unregisterFollowViews()

      expect(store.followViews).toEqual([])
      expect(store.activeFollowView).toBeNull()
    })
  })
})
