import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { CameraPreset, cameraPresets } from '@webgamekit/threejs'
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

/**
 * A real vector from anything shaped like one.
 *
 * A camera reaches this module from a view, a swap or a test double, and only the first is
 * guaranteed to carry `THREE.Vector3` methods — cloning one directly throws on the others.
 * @param vec - Anything with x, y and z, or nothing
 * @returns A vector safe to keep and mutate
 */
const toVector3 = (vec?: { x?: number; y?: number; z?: number }): THREE.Vector3 => {
  const { x, y, z } = safeVec3(vec)
  return new THREE.Vector3(x, y, z)
}

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

type CameraPresetConfig = (typeof cameraPresets)[CameraPreset]
const ORIGIN = new THREE.Vector3(0, 0, 0)
const DEFAULT_FRUSTUM_SIZE = 40

/**
 * Applies an orthographic preset scaled to the scene's own framing.
 * The preset's position direction and frustumSize/distance ratio are preserved, scaled to
 * the distance the scene declared its camera at, so the zoom level suits the scene's scale.
 *
 * Scaled to the scene's distance rather than the camera's current one: a preset that reads
 * where the camera happens to be frames differently every time it is picked, inheriting
 * whatever a sweep, a follow rig or the preset before it left behind, and never settles.
 * @param camera - The orthographic camera to reconfigure
 * @param preset - The preset configuration providing direction and frustum ratio
 * @param orbit - Optional orbit controls supplying the look-at target
 * @param aspect - The viewport aspect ratio
 * @param sceneDistance - How far the scene declared its camera from what it looks at
 */
const applyOrthographicPreset = (
  camera: THREE.OrthographicCamera,
  preset: CameraPresetConfig,
  orbit: OrbitControls | null | undefined,
  aspect: number,
  sceneDistance: number
): void => {
  const target = orbit ? orbit.target : ORIGIN
  const presetPosition = new THREE.Vector3(...preset.position)
  const presetDistance = presetPosition.length() || DEFAULT_ORBIT_DISTANCE
  const scale = (sceneDistance || presetDistance) / presetDistance
  const frustumHeight = (preset.frustumSize ?? DEFAULT_FRUSTUM_SIZE) * scale
  const halfH = frustumHeight / 2

  // Generous depth range so the scene is never clipped: near is pushed behind the
  // camera and far well past it, scaled to the distance and visible frustum size.
  const reach = (presetDistance * scale + frustumHeight) * 2

  camera.position.copy(target).add(presetPosition.multiplyScalar(scale))
  camera.left = -halfH * aspect
  camera.right = halfH * aspect
  camera.top = halfH
  camera.bottom = -halfH
  camera.near = -reach
  camera.far = reach
  camera.lookAt(target)
  camera.updateProjectionMatrix()
  if (orbit) orbit.update()
}

interface PresetApplierOptions {
  presetConfig: CameraPresetConfig
  orbit: OrbitControls | null | undefined
  aspect: number
  sceneDistance: number
  syncOrbit: (enabled: boolean) => void
}

/**
 * Builds the function that writes one preset onto whichever camera is active, so the same
 * application runs whether the projection was swapped for it or it kept the current camera.
 * @param options - The preset, the orbit controls, the viewport aspect, the scene's framing
 *   distance, and how to report the orbit setting the preset carries
 * @returns A function applying the preset to a camera
 */
const buildPresetApplier =
  ({ presetConfig, orbit, aspect, sceneDistance, syncOrbit }: PresetApplierOptions) =>
  (camera: THREE.Camera): void => {
    if (camera instanceof THREE.OrthographicCamera) {
      applyOrthographicPreset(camera, presetConfig, orbit, aspect, sceneDistance)
    } else if (camera instanceof THREE.PerspectiveCamera) {
      applyPerspectivePreset(camera, presetConfig)
    }
    // A preset that names an orbit setting carries it: the free-look presets hand the
    // camera to the viewer, the framed ones do not.
    const wantsOrbit = presetConfig.orbit ?? false
    if (orbit) setOrbitEnabled(orbit, wantsOrbit)
    syncOrbit(wantsOrbit)
  }

/**
 * Applies a perspective preset's lens without moving the camera.
 *
 * Every perspective preset shares one nominal position, so honouring it would throw away
 * wherever the view had been orbited to. Following a character is a rig's job, not a preset's.
 * @param cam - The perspective camera to reconfigure
 * @param preset - The preset configuration
 */
const applyPerspectivePreset = (cam: THREE.PerspectiveCamera, preset: CameraPresetConfig): void => {
  if (preset.fov !== undefined) cam.fov = preset.fov
  if (preset.near !== undefined) cam.near = preset.near
  if (preset.far !== undefined) cam.far = preset.far
  cam.updateProjectionMatrix()
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

/** The camera framing a scene declared, captured before anything could change it. */
interface SceneDefaultCamera extends CameraSnapshot {
  rotation: Vec3
  type: 'perspective' | 'orthographic'
  orbitEnabled: boolean
}

/**
 * Puts a camera back to the framing its scene declared.
 *
 * The projection is restored by the caller first: writing a perspective framing onto an
 * orthographic camera leaves every number right and the picture wrong.
 * @param camera - The camera to restore, already of the right projection
 * @param sceneDefault - What the scene declared
 * @param orbit - The controls that own the aim, when the view has them
 */
const applySceneDefault = (
  camera: THREE.Camera,
  sceneDefault: SceneDefaultCamera,
  orbit: OrbitControls | null | undefined
): void => {
  camera.position.copy(sceneDefault.position)
  camera.rotation.set(sceneDefault.rotation.x, sceneDefault.rotation.y, sceneDefault.rotation.z)
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = sceneDefault.fov
    camera.near = sceneDefault.near
    camera.far = sceneDefault.far
  }
  camera.updateProjectionMatrix()
  if (!orbit) return
  orbit.target.copy(sceneDefault.target)
  setOrbitEnabled(orbit, sceneDefault.orbitEnabled)
  orbit.update()
}

const CAMERA_FORWARD = new THREE.Vector3(0, 0, -1)
const lookDirection = new THREE.Vector3()

/**
 * Points the camera by moving what it looks at, rather than by setting its orientation.
 *
 * `orbit.update()` runs every frame and re-aims the camera at `orbit.target`, so an orientation
 * written directly survives exactly until the next frame. Expressed as a target the same
 * distance ahead, the same rotation holds.
 * @param camera - The camera to point
 * @param rotation - The Euler angles asked for, in radians
 * @param orbit - The controls that own the aim, when the view has them
 */
const applyCameraRotation = (
  camera: THREE.Camera,
  rotation: Vec3,
  orbit: OrbitControls | null | undefined
): void => {
  camera.rotation.set(rotation.x, rotation.y, rotation.z)
  if (!orbit) return
  const distance = orbit.target.distanceTo(camera.position) || 1
  lookDirection.copy(CAMERA_FORWARD).applyEuler(camera.rotation)
  orbit.target.copy(camera.position).addScaledVector(lookDirection, distance)
  orbit.update()
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const rotationOffset = new THREE.Vector3()

const TRANSITION_DURATION_MS = 500

interface CameraSnapshot {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
}

const snapshotCamera = (
  camera: THREE.Camera,
  orbit: OrbitControls | null | undefined
): CameraSnapshot => {
  const persp = camera as THREE.PerspectiveCamera
  const ortho = camera as THREE.OrthographicCamera
  return {
    position: toVector3(camera.position),
    target: toVector3(orbit ? orbit.target : ORIGIN),
    fov: persp.fov ?? DEFAULT_FOV,
    left: ortho.left ?? 0,
    right: ortho.right ?? 0,
    top: ortho.top ?? 0,
    bottom: ortho.bottom ?? 0,
    near: camera instanceof THREE.OrthographicCamera ? ortho.near : (persp.near ?? DEFAULT_NEAR),
    far: camera instanceof THREE.OrthographicCamera ? ortho.far : (persp.far ?? DEFAULT_FAR)
  }
}

const applyCameraSnapshot = (
  camera: THREE.Camera,
  orbit: OrbitControls | null | undefined,
  from: CameraSnapshot,
  to: CameraSnapshot,
  amount: number
): void => {
  camera.position.lerpVectors(from.position, to.position, amount)
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = THREE.MathUtils.lerp(from.fov, to.fov, amount)
  } else if (camera instanceof THREE.OrthographicCamera) {
    camera.left = THREE.MathUtils.lerp(from.left, to.left, amount)
    camera.right = THREE.MathUtils.lerp(from.right, to.right, amount)
    camera.top = THREE.MathUtils.lerp(from.top, to.top, amount)
    camera.bottom = THREE.MathUtils.lerp(from.bottom, to.bottom, amount)
  }
  camera.updateProjectionMatrix()
  if (orbit) {
    orbit.target.lerpVectors(from.target, to.target, amount)
    orbit.update()
  } else {
    camera.lookAt(to.target)
  }
}

const tweenState: { id: number | null } = { id: null }

/**
 * Smoothly animates a camera from one snapshot to another over a fixed duration.
 * @param camera - The camera to animate
 * @param orbit - Optional orbit controls kept in sync during the tween
 * @param from - The starting camera snapshot
 * @param to - The destination camera snapshot
 * @param onFrame - Called each frame after the camera is updated
 */
const tweenCamera = (
  camera: THREE.Camera,
  orbit: OrbitControls | null | undefined,
  from: CameraSnapshot,
  to: CameraSnapshot,
  onFrame: () => void
): void => {
  if (tweenState.id !== null) cancelAnimationFrame(tweenState.id)
  const startTime = performance.now()
  const step = () => {
    const progress = Math.min(1, (performance.now() - startTime) / TRANSITION_DURATION_MS)
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2
    applyCameraSnapshot(camera, orbit, from, to, eased)
    onFrame()
    tweenState.id = progress < 1 ? requestAnimationFrame(step) : null
  }
  tweenState.id = requestAnimationFrame(step)
}

/**
 * Orbits the camera around the target on the world Y axis by the given angle.
 * @param camera - The camera to reposition
 * @param orbit - Optional orbit controls supplying the pivot target
 * @param degrees - Rotation angle in degrees (positive is counter-clockwise)
 */
const rotateCameraAroundY = (
  camera: THREE.Camera,
  orbit: OrbitControls | null | undefined,
  degrees: number
): void => {
  const target = orbit ? orbit.target : ORIGIN
  rotationOffset.subVectors(camera.position, target)
  rotationOffset.applyAxisAngle(Y_AXIS, THREE.MathUtils.degToRad(degrees))
  camera.position.copy(target).add(rotationOffset)
  camera.lookAt(target)
  if (orbit) orbit.update()
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
    } else if (
      activeCamera instanceof THREE.OrthographicCamera &&
      (path === 'near' || path === 'far')
    ) {
      activeCamera[path] = value as number
      activeCamera.updateProjectionMatrix()
    }
    if (path === 'position') {
      const pos = value as Vec3
      activeCamera.position.set(pos.x, pos.y, pos.z)
      if (orbit) orbit.update()
    } else if (path === 'rotation') {
      applyCameraRotation(activeCamera, value as Vec3, orbit)
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
      // Editing the camera by hand is reaching for it, so the rig lets go — otherwise the next
      // frame overwrites whatever was just typed, exactly as a preset would.
      useCameraConfigStore().releaseCameraFromRig()
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

  // Registered whether or not the caller brought its own config: skipping it left the panel's
  // preset buttons wired to nothing in every view that goes through the scene store, which is
  // every view that passes one. The only view with its own preset handlers is the scene editor,
  // and it registers them after its own init, so it still wins.
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
  cameraConfigStore.syncOrbitEnabled(orbit?.enabled ?? false)

  // Captured before anything can move the camera, which is what makes it the scene's own
  // framing rather than a default the app invented.
  const sceneDefault = {
    ...snapshotCamera(initialCamera, orbit),
    // Read the tolerant way, as the rest of this module does: a camera reaches here from a
    // view, a test double or a swap, and not all of them carry a real Euler.
    rotation: safeVec3(initialCamera.rotation),
    type: cameraType,
    orbitEnabled: orbit?.enabled ?? false
  }

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

  /**
   * Returns the active camera already in the wanted projection, swapping it if it is not.
   * @param wanted - The projection to end up in
   * @returns The camera to write the restored framing onto
   */
  const restoreProjection = (wanted: 'perspective' | 'orthographic'): THREE.Camera => {
    if (wanted === getCameraType()) return getActiveCamera()
    const swapped = buildNewCamera(wanted)
    setCamera?.(swapped)
    setActiveCamera(swapped)
    setCameraType(wanted)
    return swapped
  }

  const syncConfig = (active: THREE.Camera) => {
    cameraConfig.value = { ...cameraConfig.value, ...buildDefaults(active) }
  }

  /** Applies a same-type camera change, tweening between states when transitions are enabled. */
  const applyWithOptionalTween = (active: THREE.Camera, applyChange: () => void) => {
    if (!cameraConfigStore.transitionEnabled) {
      applyChange()
      syncConfig(active)
      return
    }
    const from = snapshotCamera(active, orbit)
    applyChange()
    const to = snapshotCamera(active, orbit)
    applyCameraSnapshot(active, orbit, from, to, 0)
    tweenCamera(active, orbit, from, to, () => syncConfig(active))
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
        if (!presetConfig) return
        const targetType = presetConfig.type as 'perspective' | 'orthographic'
        const applyPreset = buildPresetApplier({
          presetConfig,
          orbit,
          aspect: getAspect(),
          sceneDistance: sceneDefault.position.distanceTo(sceneDefault.target),
          syncOrbit: cameraConfigStore.syncOrbitEnabled
        })

        if (targetType !== getCameraType()) {
          if (!setCamera) return
          const active = buildNewCamera(targetType)
          setCamera(active)
          setActiveCamera(active)
          setCameraType(targetType)
          applyPreset(active)
          syncConfig(active)
          return
        }

        const active = getActiveCamera()
        applyWithOptionalTween(active, () => applyPreset(active))
      },
      onRotate: (_slotId, degrees) => {
        const active = getActiveCamera()
        applyWithOptionalTween(active, () => rotateCameraAroundY(active, orbit, degrees))
      },
      onSlotActivate: () => {},
      onOrbitToggle: (enabled) => {
        if (orbit) setOrbitEnabled(orbit, enabled)
      },
      onResetToSceneDefault: () => {
        const restored = restoreProjection(sceneDefault.type)
        applySceneDefault(restored, sceneDefault, orbit)
        cameraConfigStore.syncOrbitEnabled(sceneDefault.orbitEnabled)
        syncConfig(restored)
        return sceneDefault.type
      },
      onCleanup: () => {}
    }
  )
}
