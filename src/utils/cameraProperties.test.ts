import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as THREE from 'three'
import { CameraPreset, cameraPresets } from '@webgamekit/threejs'

vi.mock('@/views/Tools/SceneEditor/config', () => ({
  cameraSchema: {
    position: {},
    rotation: {},
    fov: {},
    near: {},
    far: {},
    orbitTarget: {},
    orbitEnabled: {}
  }
}))

vi.mock('@/utils/threeObjectUpdaters', () => ({
  updateCameraFov: vi.fn(),
  setOrbitEnabled: vi.fn()
}))

const makePerspCamera = () => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(0, 5, 20)
  return cam
}

const makeOrbit = (target = new THREE.Vector3()) => ({
  target,
  enabled: true,
  update: vi.fn(),
  addEventListener: vi.fn()
})

describe('registerCameraProperties', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('registers Camera in elementPropertiesStore with full schema', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')

    const camera = makePerspCamera()
    registerCameraProperties({ camera })

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    const props = store.activeProperties
    expect(props).toBeDefined()
    expect(props!.type).toBe('camera')
    expect(Object.keys(props!.schema)).toContain('rotation')
    expect(Object.keys(props!.schema)).toContain('near')
    expect(Object.keys(props!.schema)).toContain('far')
  })

  it('initialises config with position, rotation, fov, near, far from camera', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')

    const camera = makePerspCamera()
    camera.position.set(10, 20, 30)
    registerCameraProperties({ camera })

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    const props = store.activeProperties!
    expect(props.getValue('position')).toEqual({ x: 10, y: 20, z: 30 })
    expect(props.getValue('fov')).toBe(75)
    expect(props.getValue('near')).toBe(0.1)
    expect(props.getValue('far')).toBe(1000)
    expect(props.getValue('rotation')).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number)
    })
  })

  it('backfills missing keys when an external config is provided', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { ref } = await import('vue')
    const camera = makePerspCamera()
    const externalConfig = ref<Record<string, unknown>>({ fov: 60 })

    registerCameraProperties({ camera, cameraConfig: externalConfig })

    expect(externalConfig.value.near).toBe(0.1)
    expect(externalConfig.value.far).toBe(1000)
    expect(externalConfig.value.rotation).toBeDefined()
    expect((externalConfig.value as Record<string, unknown>).fov).toBe(60)
  })

  it('syncs position and rotation from orbit change event', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')

    const camera = makePerspCamera()
    let changeListener: (() => void) | undefined
    const orbit = {
      ...makeOrbit(),
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === 'change') changeListener = callback
      })
    }

    registerCameraProperties({ camera, orbit })

    camera.position.set(5, 10, 15)
    camera.rotation.set(0.1, 0.2, 0.3)
    changeListener?.()

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    const props = store.activeProperties!
    expect(props.getValue('position')).toEqual({ x: 5, y: 10, z: 15 })
    expect((props.getValue('rotation') as Record<string, number>).x).toBeCloseTo(0.1)
  })

  it('registers camera handlers with correct initial preset for PerspectiveCamera', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')

    const camera = makePerspCamera()
    registerCameraProperties({ camera })

    const store = useCameraConfigStore()
    expect(store.activeSlot?.preset).toBe(CameraPreset.Perspective)
  })

  it('onPresetChange applies FOV from same-type preset without moving camera', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')

    const camera = makePerspCamera()
    camera.position.set(10, 20, 30)
    registerCameraProperties({ camera })

    const store = useCameraConfigStore()
    store.applyPresetToActiveSlot(CameraPreset.Fisheye)

    expect(camera.fov).toBe(cameraPresets[CameraPreset.Fisheye].fov)
    expect(camera.position.x).toBe(10)
    expect(camera.position.y).toBe(20)
    expect(camera.position.z).toBe(30)
  })

  it('wires the preset buttons even when the caller brings its own config', async () => {
    // The scene store always passes a config, so guarding registration on its absence left
    // every view that goes through the store with preset buttons connected to nothing.
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')
    const { ref } = await import('vue')

    const camera = makePerspCamera()
    registerCameraProperties({ camera, cameraConfig: ref<Record<string, unknown>>({}) })

    const store = useCameraConfigStore()
    store.applyPresetToActiveSlot(CameraPreset.Fisheye)

    expect(camera.fov).toBe(cameraPresets[CameraPreset.Fisheye].fov)
  })

  it.each([
    { preset: CameraPreset.Perspective, orbit: true },
    { preset: CameraPreset.Fisheye, orbit: true },
    { preset: CameraPreset.Orthographic, orbit: false },
    { preset: CameraPreset.TopDown, orbit: false }
  ])('applies $preset with orbit $orbit', async ({ preset, orbit }) => {
    // The free-look presets hand the camera to the viewer; the framed ones hold their framing.
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')
    const { setOrbitEnabled } = await import('@/utils/threeObjectUpdaters')

    const orbitControls = makeOrbit()
    registerCameraProperties({
      camera: makePerspCamera(),
      orbit: orbitControls,
      setCamera: () => orbitControls
    })

    const store = useCameraConfigStore()
    store.applyPresetToActiveSlot(preset)

    expect(setOrbitEnabled).toHaveBeenLastCalledWith(orbitControls, orbit)
    expect(store.orbitEnabled).toBe(orbit)
  })

  it('points the camera by moving what it looks at, so the rotation survives orbit', async () => {
    // orbit.update() re-aims at its target every frame, so an orientation written straight onto
    // the camera lasts exactly one frame. Expressed as a target ahead, the same rotation holds.
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')

    const camera = makePerspCamera()
    camera.position.set(0, 0, 20)
    const orbit = makeOrbit(new THREE.Vector3(0, 0, 0))
    registerCameraProperties({ camera, orbit })

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    store.activeProperties!.updateValue('rotation', { x: 0, y: Math.PI / 2, z: 0 })

    // A camera looks down its own -Z, so turning +90 degrees about Y faces -X: from (0, 0, 20)
    // at the original distance of 20 that puts the target at (-20, 0, 20).
    expect(orbit.target.x).toBeCloseTo(-20)
    expect(orbit.target.z).toBeCloseTo(20)
    expect(orbit.update).toHaveBeenCalled()
  })

  it('lets go of the follow rig when the camera is edited by hand', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')

    registerCameraProperties({ camera: makePerspCamera(), orbit: makeOrbit() })
    const cameraStore = useCameraConfigStore()
    const onChange = vi.fn()
    cameraStore.registerFollowViews([{ value: 'third', label: 'Third' }], 'third', onChange)

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    store.activeProperties!.updateValue('position', { x: 1, y: 2, z: 3 })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('registers slot with supportedCameraTypes matching the camera type', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')

    const camera = makePerspCamera()
    registerCameraProperties({ camera })

    const store = useCameraConfigStore()
    expect(store.activeSlot?.supportedCameraTypes).toEqual(['perspective'])
  })

  it('offers both projections once a camera swap is available', async () => {
    // Without setCamera the panel can only report the projection already in use, which is why
    // the orthographic camera and every orthographic preset were unreachable from the UI.
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useCameraConfigStore } = await import('@/stores/cameraConfig')

    registerCameraProperties({ camera: makePerspCamera(), setCamera: () => null })

    const store = useCameraConfigStore()
    expect(store.activeSlot?.supportedCameraTypes).toEqual(['perspective', 'orthographic'])
  })

  it('keeps every perspective preset a lens change rather than a placement', () => {
    // A preset cannot follow anything: it fires once and knows no target. Naming one after a
    // follow mode promised tracking the elements panel has no way to deliver.
    const perspective = Object.values(CameraPreset).filter(
      (preset) => cameraPresets[preset].type === 'perspective'
    )
    expect(perspective.length).toBeGreaterThan(0)
    perspective.forEach((preset) => expect(cameraPresets[preset].lookAt).toBeUndefined())
  })

  it('orbitEnabled toggle calls setOrbitEnabled', async () => {
    const { registerCameraProperties } = await import('./cameraProperties')
    const { useElementPropertiesStore } = await import('@/stores/elementProperties')
    const { setOrbitEnabled } = await import('@/utils/threeObjectUpdaters')

    const camera = makePerspCamera()
    const orbit = makeOrbit()
    registerCameraProperties({ camera, orbit })

    const store = useElementPropertiesStore()
    store.openElementProperties('Camera')
    const props = store.activeProperties!
    props.updateValue('orbitEnabled', false)

    expect(setOrbitEnabled).toHaveBeenCalledWith(orbit, false)
  })
})
