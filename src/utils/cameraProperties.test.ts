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

  it.each([
    { preset: CameraPreset.FirstPerson, projection: 'perspective' },
    { preset: CameraPreset.ThirdPerson, projection: 'perspective' },
    { preset: CameraPreset.OrthographicFirstPerson, projection: 'orthographic' },
    { preset: CameraPreset.OrthographicThirdPerson, projection: 'orthographic' }
  ])('offers $preset as a $projection preset', ({ preset, projection }) => {
    expect(cameraPresets[preset]).toBeDefined()
    expect(cameraPresets[preset].type).toBe(projection)
  })

  it('gives the first and third person presets a matching pair in each projection', () => {
    // The pairs exist so switching projection keeps the framing, rather than throwing the
    // viewer somewhere unrelated.
    expect(cameraPresets[CameraPreset.OrthographicFirstPerson].position).toEqual(
      cameraPresets[CameraPreset.FirstPerson].position
    )
    expect(cameraPresets[CameraPreset.OrthographicThirdPerson].position).toEqual(
      cameraPresets[CameraPreset.ThirdPerson].position
    )
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
