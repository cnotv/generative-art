import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { CameraPreset, cameraPresets, setCameraPreset } from '@webgamekit/threejs'
import { cameraSchema } from '@/views/Tools/SceneEditor/config'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useCameraConfigStore } from '@/stores/cameraConfig'
import { updateCameraFov, setOrbitEnabled } from '@/utils/threeObjectUpdaters'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'

type Vec3 = { x: number; y: number; z: number }
interface RegisterCameraOptions {
  camera: THREE.Camera
  orbit?: OrbitControls | null
  renderer?: THREE.WebGLRenderer
  cameraConfig?: Ref<Record<string, unknown>>
  skipOrbitSync?: boolean
  schema?: Record<string, unknown>
  /** When provided, enables camera type switching (perspective ↔ orthographic). */
  setCamera?: (newCamera: THREE.Camera) => OrbitControls | null
}

const DEFAULT_FOV = 75
const DEFAULT_NEAR = 0.1
const DEFAULT_FAR = 10000
const DEFAULT_ORBIT_DISTANCE = 10

const safeVec3 = (vec?: { x?: number; y?: number; z?: number }) => ({
  x: vec?.x ?? 0,
  y: vec?.y ?? 0,
  z: vec?.z ?? 0
})

const buildCameraDefaults = (cam: THREE.Camera, orbit?: OrbitControls | null) => {
  const persp = cam as THREE.PerspectiveCamera
  const orbitTarget = orbit?.target ?? { x: 0, y: 0, z: 0 }
  return {
    position: safeVec3(cam.position),
    rotation: safeVec3(cam.rotation),
    fov: persp.fov ?? DEFAULT_FOV,
    near: persp.near ?? DEFAULT_NEAR,
    far: persp.far ?? DEFAULT_FAR,
    orbitTarget: safeVec3(orbitTarget),
    orbitEnabled: orbit?.enabled ?? false
  }
}

const buildPerspToOrtho = (
  persp: THREE.PerspectiveCamera,
  orbit: OrbitControls | null | undefined,
  aspect: number
): THREE.OrthographicCamera => {
  const distance = orbit ? orbit.target.distanceTo(persp.position) : DEFAULT_ORBIT_DISTANCE
  const frustumHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))
  const halfH = frustumHeight / 2
  const ortho = new THREE.OrthographicCamera(
    -halfH * aspect,
    halfH * aspect,
    halfH,
    -halfH,
    persp.near,
    persp.far
  )
  ortho.position.copy(persp.position)
  ortho.rotation.copy(persp.rotation)
  return ortho
}

const buildOrthoToPersp = (
  ortho: THREE.OrthographicCamera,
  orbit: OrbitControls | null | undefined,
  aspect: number
): THREE.PerspectiveCamera => {
  const frustumHeight = ortho.top - ortho.bottom
  const distance = orbit ? orbit.target.distanceTo(ortho.position) : DEFAULT_ORBIT_DISTANCE
  const fov = 2 * THREE.MathUtils.radToDeg(Math.atan2(frustumHeight / 2, distance))
  const persp = new THREE.PerspectiveCamera(fov, aspect, ortho.near, ortho.far)
  persp.position.copy(ortho.position)
  persp.rotation.copy(ortho.rotation)
  return persp
}

const applyPerspectiveProperty = (
  path: string,
  value: unknown,
  cam: THREE.PerspectiveCamera
): void => {
  if (path === 'fov') {
    updateCameraFov(cam, value as number)
    return
  }
  if (path === 'near') {
    cam.near = value as number
    cam.updateProjectionMatrix()
    return
  }
  if (path === 'far') {
    cam.far = value as number
    cam.updateProjectionMatrix()
  }
}

const applyOrbitProperty = (path: string, value: unknown, orbit: OrbitControls): void => {
  if (path === 'orbitTarget') {
    const target = value as Vec3
    orbit.target.set(target.x, target.y, target.z)
    orbit.update()
  } else if (path === 'orbitEnabled') {
    setOrbitEnabled(orbit, value as boolean)
  }
}

/**
 * Registers camera element properties with orbit sync.
 * Handles: schema-based property panel, Three.js updates on change,
 * and orbit controls → panel reactivity.
 *
 * @param options.camera - The Three.js camera
 * @param options.orbit - Optional orbit controls instance
 * @param options.cameraConfig - Optional external ref to use for camera state
 * @param options.setCamera - Optional callback to swap the active render camera
 * @returns The cameraConfig ref (same as passed in, or newly created)
 */
export const registerCameraProperties = ({
  camera: initialCamera,
  orbit,
  renderer,
  cameraConfig: externalConfig,
  skipOrbitSync,
  schema,
  setCamera
}: RegisterCameraOptions) => {
  const elementPropertiesStore = useElementPropertiesStore()

  let activeCamera: THREE.Camera = initialCamera
  let cameraType: 'perspective' | 'orthographic' =
    initialCamera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic'

  const buildDefaults = (cam: THREE.Camera) => buildCameraDefaults(cam, orbit)

  if (externalConfig) {
    externalConfig.value = { ...buildDefaults(initialCamera), ...externalConfig.value }
  }
  const cameraConfig = externalConfig ?? ref<Record<string, unknown>>(buildDefaults(initialCamera))

  const applyCameraUpdate = (path: string, value: unknown) => {
    if (activeCamera instanceof THREE.PerspectiveCamera) {
      applyPerspectiveProperty(path, value, activeCamera)
    }
    if (path === 'position') {
      const pos = value as Vec3
      activeCamera.position.set(pos.x, pos.y, pos.z)
      if (orbit && orbit.enabled) orbit.update()
    } else if (path === 'rotation' && !(orbit && orbit.enabled)) {
      const rot = value as Vec3
      activeCamera.rotation.set(rot.x, rot.y, rot.z)
    } else if (orbit) {
      applyOrbitProperty(path, value, orbit)
    }
  }

  elementPropertiesStore.registerElementProperties('Camera', {
    title: 'Camera',
    type: 'camera',
    schema: schema ?? cameraSchema,
    getValue: (path) => getNestedValue(cameraConfig.value, path),
    updateValue: (path, value) => {
      cameraConfig.value = setNestedValueImmutable(cameraConfig.value, path, value)
      applyCameraUpdate(path, value)
    }
  })

  if (orbit && !skipOrbitSync) {
    orbit.addEventListener('change', () => {
      cameraConfig.value = {
        ...cameraConfig.value,
        position: {
          x: activeCamera.position.x,
          y: activeCamera.position.y,
          z: activeCamera.position.z
        },
        rotation: {
          x: activeCamera.rotation.x,
          y: activeCamera.rotation.y,
          z: activeCamera.rotation.z
        },
        orbitTarget: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z }
      }
    })
  }

  if (!externalConfig) {
    registerCameraPresetHandlers({
      orbit,
      renderer,
      setCamera,
      getActiveCamera: () => activeCamera,
      getCameraType: () => cameraType,
      setActiveCamera: (cam) => {
        activeCamera = cam
      },
      setCameraType: (type) => {
        cameraType = type
      },
      cameraConfig,
      buildDefaults,
      initialCamera,
      cameraType
    })
  }

  return { cameraConfig }
}

interface PresetHandlerOptions {
  orbit?: OrbitControls | null
  renderer?: THREE.WebGLRenderer
  setCamera?: (newCamera: THREE.Camera) => OrbitControls | null
  getActiveCamera: () => THREE.Camera
  getCameraType: () => 'perspective' | 'orthographic'
  setActiveCamera: (cam: THREE.Camera) => void
  setCameraType: (type: 'perspective' | 'orthographic') => void
  cameraConfig: Ref<Record<string, unknown>>
  buildDefaults: (cam: THREE.Camera) => ReturnType<typeof buildCameraDefaults>
  initialCamera: THREE.Camera
  cameraType: 'perspective' | 'orthographic'
}

const registerCameraPresetHandlers = ({
  orbit,
  renderer,
  setCamera,
  getActiveCamera,
  getCameraType,
  setActiveCamera,
  setCameraType,
  cameraConfig,
  buildDefaults,
  initialCamera,
  cameraType
}: PresetHandlerOptions): void => {
  const cameraConfigStore = useCameraConfigStore()

  const getAspect = () =>
    renderer
      ? renderer.domElement.width / renderer.domElement.height
      : window.innerWidth / window.innerHeight

  const buildNewCamera = (targetType: 'perspective' | 'orthographic'): THREE.Camera => {
    const aspect = getAspect()
    const active = getActiveCamera()
    if (targetType === 'orthographic') {
      return buildPerspToOrtho(active as THREE.PerspectiveCamera, orbit, aspect)
    }
    return buildOrthoToPersp(active as THREE.OrthographicCamera, orbit, aspect)
  }

  const initialPreset =
    cameraType === 'perspective' ? CameraPreset.Perspective : CameraPreset.Orthographic
  const supportedCameraTypes: Array<'perspective' | 'orthographic'> = setCamera
    ? ['perspective', 'orthographic']
    : [cameraType]

  cameraConfigStore.registerCameraHandlers(
    [
      {
        id: 'cam-default',
        label: 'Camera',
        preset: initialPreset,
        position: [
          initialCamera.position?.x ?? 0,
          initialCamera.position?.y ?? 0,
          initialCamera.position?.z ?? 0
        ],
        fov: (initialCamera as THREE.PerspectiveCamera).fov ?? DEFAULT_FOV,
        orbitTarget: orbit ? [orbit.target.x, orbit.target.y, orbit.target.z] : [0, 0, 0],
        supportedCameraTypes
      }
    ],
    {
      onPresetChange: (_slotId, preset) => {
        const presetConfig = cameraPresets[preset]
        const targetType = presetConfig?.type as 'perspective' | 'orthographic' | undefined
        const aspect = getAspect()

        if (targetType && targetType !== getCameraType()) {
          if (!setCamera) return
          const newCamera = buildNewCamera(targetType)
          setCameraPreset(
            newCamera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
            preset,
            aspect
          )
          setCamera(newCamera)
          setActiveCamera(newCamera)
          setCameraType(targetType)
          cameraConfig.value = { ...cameraConfig.value, ...buildDefaults(newCamera) }
          return
        }

        if (presetConfig) {
          const active = getActiveCamera()
          if (active instanceof THREE.OrthographicCamera) {
            setCameraPreset(active, preset, aspect)
          } else if (active instanceof THREE.PerspectiveCamera) {
            if (presetConfig.fov !== undefined) {
              active.fov = presetConfig.fov
              active.updateProjectionMatrix()
            }
            if (presetConfig.near !== undefined) {
              active.near = presetConfig.near
              active.updateProjectionMatrix()
            }
            if (presetConfig.far !== undefined) {
              active.far = presetConfig.far
              active.updateProjectionMatrix()
            }
          }
          const updates: Record<string, unknown> = {
            position: { x: active.position.x, y: active.position.y, z: active.position.z }
          }
          if (presetConfig.fov !== undefined) updates.fov = presetConfig.fov
          if (presetConfig.near !== undefined) updates.near = presetConfig.near
          if (presetConfig.far !== undefined) updates.far = presetConfig.far
          cameraConfig.value = { ...cameraConfig.value, ...updates }
        }
      },
      onSlotActivate: () => {},
      onCleanup: () => {}
    }
  )
}
