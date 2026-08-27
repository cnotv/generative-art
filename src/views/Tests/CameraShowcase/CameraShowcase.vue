<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRaw, watch } from 'vue'
import * as THREE from 'three'
import {
  getCube,
  getCylinder,
  cameraPathCreate,
  cameraPathIsActive,
  DEFAULT_FOLLOW_CAMERA,
  type CameraPath,
  type FollowCameraMode
} from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import { registerFollowCameraPanel, type FollowCameraPanel } from '@/utils/followCameraPanel'
import { useSceneViewStore } from '@/stores/sceneView'
import { useDebugSceneStore } from '@/stores/debugScene'
import {
  pathCreateVisualization,
  pathCreateSteppedVisualization,
  pathRemoveVisualization,
  pathInterpolateWaypoints,
  pathCreateWaypointNode,
  pathRemoveWaypointNodes,
  pathUpdateWaypointNodePosition
} from '@/utils/pathVisualization'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { usePanelsStore } from '@/stores/panels'
import { useCameraConfigStore } from '@/stores/cameraConfig'
import { pathGetEasingProgress, type EasingName } from '@/utils/pathEasing'
import type { PathConfig } from '@/stores/debugScene'
import {
  setupConfig,
  CAMERA_VIEWS,
  PATH_LINE_COLOR,
  PATH_LINE_RADIUS,
  PATH_NODE_SIZE,
  PATH_DEFAULT_CONFIG,
  CONTROLS,
  CASE_BY_ACTION,
  CAMERA_CASES,
  MONUMENT_STEPS,
  MONUMENT_BEAMS,
  COLUMN,
  COLUMN_POSITIONS,
  TARGET,
  INTRO_PATH,
  PATH_LOOK_AT,
  CAMERA_CASE_LABELS
} from './config'
import {
  trackPose,
  isFollowCase,
  toCameraCase,
  stepCameraCase,
  applyCameraFrame
} from './cameraShowcase'
import type { CameraCase } from './config'

const store = useSceneViewStore()
const debugSceneStore = useDebugSceneStore()
const elementPropertiesStore = useElementPropertiesStore()
const panelsStore = usePanelsStore()
const cameraConfigStore = useCameraConfigStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const selectedCaseValue = ref<CameraCase>('path')

/** Driven by the number keys and by the Camera element's view buttons alike. */
const selectedCase = computed({
  get: () => toCameraCase(selectedCaseValue.value),
  set: (value: CameraCase) => {
    selectedCaseValue.value = value
  }
})

const { destroyControls } = createControls({
  ...CONTROLS,
  onAction: (action: string) => {
    if (action === 'case-next')
      return void (selectedCase.value = stepCameraCase(selectedCase.value, 1))
    if (action === 'case-previous')
      return void (selectedCase.value = stepCameraCase(selectedCase.value, -1))
    const direct = CASE_BY_ACTION[action]
    if (direct) selectedCase.value = direct
  }
})

/**
 * The rig's tabs, bound to the case the view is already switching on, so choosing a tab in the
 * panel and pressing its number key are the same action. Non-follow cases leave the tabs on
 * chase rather than inventing a fourth state for them.
 */
const followMode = computed<FollowCameraMode>({
  get: () => (isFollowCase(selectedCase.value) ? selectedCase.value : 'third'),
  set: (mode) => {
    selectedCase.value = mode
  }
})

// Pre-allocated: these are read every frame and the animation loop must not allocate.
const targetPosition = new THREE.Vector3()
const targetDirection = new THREE.Vector3()
const FORWARD = new THREE.Vector3(0, 0, 1)
const lookTarget = new THREE.Vector3()

/** Where the intro sweep holds its gaze; every point in the path shares this look target. */
const pathLookAt = new THREE.Vector3(...PATH_LOOK_AT)
const ORIGIN = new THREE.Vector3(0, 0, 0)

/**
 * The follow modes' offsets, tuned from the elements panel.
 *
 * A preset cannot do this job: it fires once and knows no target, so the panel's lens presets
 * and this rig are different controls rather than rival ones.
 */
let followPanel: FollowCameraPanel | null = null

let target: THREE.Object3D | null = null
let introPath: CameraPath | null = null
let pathLine: THREE.Group | null = null
let pathNodes: THREE.Mesh[] = []
let nodeGeometry: THREE.BufferGeometry | null = null
let nodeMaterial: THREE.Material | null = null

/** The route being edited, which starts as the declared sweep and diverges as it is changed. */
const pathWaypoints = ref<CoordinateTuple[]>(INTRO_PATH.map((position) => [...position]))
const pathConfig = reactive<PathConfig>({ ...PATH_DEFAULT_CONFIG } as PathConfig)

const MINIMUM_PATH_POINTS = 2
const MINIMUM_PATH_SECONDS = 0.5
let pathLapReversed = false

const PATH_ELEMENT_ID = 'camera-path'
const CAMERA_ELEMENT = 'Camera'
const asWaypoint = ([x, y, z]: CoordinateTuple) => ({ x, y, z })
let elapsedSeconds = 0

/**
 * Redraws the tube alone, leaving the nodes where they are.
 *
 * Torn down and rebuilt rather than reshaped: a Catmull-Rom tube's geometry depends on every
 * point, so a moved waypoint is not a local edit to it. The nodes are separate meshes and can
 * be moved one at a time, which is what a drag does.
 */
const redrawRoute = (): void => {
  const scene = toRaw(store.threeScene)
  if (!scene) return
  if (pathLine) pathRemoveVisualization(scene, pathLine)
  pathLine = null
  if (pathWaypoints.value.length < MINIMUM_PATH_POINTS) return

  const waypoints = pathWaypoints.value.map(asWaypoint)
  pathLine = pathConfig.curved
    ? pathCreateVisualization(
        scene,
        pathInterpolateWaypoints(waypoints),
        PATH_LINE_COLOR,
        PATH_LINE_RADIUS,
        pathConfig.loop
      )
    : pathCreateSteppedVisualization(
        scene,
        waypoints,
        PATH_LINE_COLOR,
        PATH_LINE_RADIUS,
        pathConfig.loop
      )
  // Tags the tube so a viewport click on it resolves to the element that owns the path.
  pathLine.userData.pathElementName = CAMERA_ELEMENT
  // The name the scene store filters out of the elements list: the route is scenery for the
  // camera, not something to select or hide on its own row.
  pathLine.name = 'PathDebug'
  applyPathVisibility()
}

/** Redraws the route and rebuilds every node, for a change to which waypoints exist. */
const rebuildPathVisuals = (): void => {
  const scene = toRaw(store.threeScene)
  if (!scene) return

  pathRemoveWaypointNodes(scene, pathNodes)
  nodeGeometry ??= new THREE.BoxGeometry(PATH_NODE_SIZE, PATH_NODE_SIZE, PATH_NODE_SIZE)
  nodeMaterial ??= new THREE.MeshBasicMaterial({ color: PATH_LINE_COLOR })
  pathNodes = pathWaypoints.value.map((waypoint) =>
    pathCreateWaypointNode(scene, asWaypoint(waypoint), nodeGeometry!, nodeMaterial!)
  )

  redrawRoute()
}

/**
 * Shows the route only while the Camera element is the one selected in the panel, which is the
 * same rule every other path in the app follows.
 */
const applyPathVisibility = (): void => {
  const editing =
    panelsStore.isElementsOpen && elementPropertiesStore.selectedElementName === CAMERA_ELEMENT
  if (pathLine) pathLine.visible = editing && pathConfig.showPath
  pathNodes.forEach((node) => {
    node.visible = editing && pathConfig.showNodes
  })
}

/**
 * The camera the store is rendering right now.
 *
 * Read at use rather than captured from `defineSetup`: choosing an orthographic preset replaces
 * the camera object, and a captured reference leaves this view steering one that is no longer
 * on screen — the follow cases stop holding the target the moment the projection is switched.
 * @returns The active camera, or null before the scene has initialised
 */
const currentCamera = (): THREE.Camera | null => toRaw(store.threeCamera)

/**
 * How long the sweep should take, from its length and the speed on the panel.
 *
 * Derived rather than fixed, so adding a waypoint that lengthens the route does not also speed
 * the camera up to keep the old duration.
 * @returns Seconds to travel the whole route
 */
const pathSeconds = (): number => {
  const curve = new THREE.CatmullRomCurve3(
    pathWaypoints.value.map((waypoint) => new THREE.Vector3(...waypoint))
  )
  return Math.max(curve.getLength() / Math.max(pathConfig.speed, 1), MINIMUM_PATH_SECONDS)
}

/**
 * The scene object the camera panel is pointing at.
 * @returns The chosen object, or null while nothing is selected or the scene is not ready
 */
const followedObject = (): THREE.Object3D | null => {
  const scene = toRaw(store.threeScene)
  const name = followPanel?.targetName.value
  return scene && name ? (scene.getObjectByName(name) ?? null) : null
}

/** Restart the cinematic sweep from the waypoints and settings as they stand. */
const startIntroPath = (): void => {
  const camera = currentCamera()
  if (!camera) return
  introPath?.cancel()

  const waypoints =
    pathConfig.pingPong && pathLapReversed
      ? [...pathWaypoints.value].reverse()
      : pathWaypoints.value
  if (waypoints.length < MINIMUM_PATH_POINTS) {
    introPath = null
    return
  }

  introPath = cameraPathCreate(camera, {
    points: waypoints.map((position) => ({ position, lookAt: PATH_LOOK_AT })),
    seconds: pathSeconds(),
    curved: pathConfig.curved,
    easing: (progress) =>
      pathGetEasingProgress(progress, pathConfig.easing as EasingName, pathConfig.easingIntensity),
    onComplete: () => {
      introPath = null
      // Ping pong turns round rather than jumping back to the start; loop does jump back.
      if (pathConfig.pingPong) pathLapReversed = !pathLapReversed
      if (pathConfig.loop || pathConfig.pingPong) startIntroPath()
    }
  })
}

/** Stop the sweep and leave the camera wherever it stands. */
const stopIntroPath = (): void => {
  introPath?.cancel()
  introPath = null
}

/**
 * Taking hold of the camera ends the sweep: a path that keeps flying while someone drags or
 * rotates the camera fights them for it every frame.
 */
const stopIntroPathOnCameraInput = (): void => {
  if (introPath) stopIntroPath()
}

/**
 * Only a drag that can actually move the camera counts. With orbit switched off, a press on
 * the canvas is aimed at a waypoint or an element, and killing the sweep for that is a
 * surprise rather than a handover.
 */
const stopIntroPathOnDrag = (): void => {
  if (toRaw(store.orbitReference)?.enabled) stopIntroPathOnCameraInput()
}

watch(selectedCaseValue, (value) => {
  if (toCameraCase(value) !== 'path') {
    stopIntroPath()
    return
  }
  // Picking the sweep plays it as a loop; the Loop control can still stop it afterwards.
  pathConfig.loop = true
  // Unticked rather than overridden: the tube runs along the camera's own line, so flying it
  // means looking at the inside of it. Saying so through the control that already governs this
  // leaves the choice visible, and re-tickable, instead of hidden in a condition.
  pathConfig.showPath = false
  applyPathVisibility()
  startIntroPath()
})

watch(
  [() => elementPropertiesStore.selectedElementName, () => panelsStore.isElementsOpen],
  applyPathVisibility
)

/** Camera panel actions that reposition or re-aim the camera by hand. */
const CAMERA_MOVE_ACTIONS = new Set(['rotateActiveSlot', 'resetCameraToSceneDefault'])

const stopSweepOnPanelMove = cameraConfigStore.$onAction(({ name }) => {
  if (CAMERA_MOVE_ACTIONS.has(name)) stopIntroPathOnCameraInput()
})

onMounted(async () => {
  if (!canvas.value) return
  canvas.value.addEventListener('pointerdown', stopIntroPathOnDrag)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: false, showScene: true },
    defineSetup: ({ scene, world, getDelta, animate }) => {
      MONUMENT_STEPS.forEach((step) => getCube(scene, world, step))
      COLUMN_POSITIONS.forEach((position) => getCylinder(scene, world, { ...COLUMN, position }))
      MONUMENT_BEAMS.forEach((beam) => getCube(scene, world, beam))
      target = getCube(scene, world, TARGET)

      const timeline = createTimelineManager()

      timeline.addAction({
        name: 'drive the target around the track',
        category: 'game-logic',
        action: () => {
          if (!target) return
          elapsedSeconds += getDelta()

          const pose = trackPose(elapsedSeconds)
          target.position.set(...pose.position)
          target.lookAt(
            pose.position[0] + pose.direction[0],
            pose.position[1],
            pose.position[2] + pose.direction[2]
          )
        }
      })

      timeline.addAction({
        name: 'apply the selected camera case',
        category: 'visual',
        action: () => {
          // A running path owns the camera; every other case stands down until it finishes.
          // Paused, it keeps the camera exactly where the last frame left it.
          const pathOwnsCamera = pathConfig.playing && introPath?.update(getDelta()) === true
          if (pathOwnsCamera) lookTarget.copy(pathLookAt)

          // Read off the chosen element rather than the track pose, so pointing the panel at a
          // landmark follows the landmark instead of quietly still following the target.
          const followed = followedObject()
          if (followed) {
            targetPosition.copy(followed.position)
            targetDirection.copy(FORWARD).applyQuaternion(followed.quaternion).setY(0).normalize()
          }

          // Writes nothing when the rig is switched off, leaving the Camera element to drive.
          applyCameraFrame({
            getCamera: currentCamera,
            orbit: toRaw(store.orbitReference),
            selected: selectedCase.value,
            targetPosition,
            targetDirection,
            follow: followPanel?.config ?? DEFAULT_FOLLOW_CAMERA,
            lookTarget,
            pathOwnsCamera: pathOwnsCamera || cameraPathIsActive(),
            followEnabled: followPanel?.enabled.value ?? true
          })
        }
      })

      animate({ timeline })
    }
  })

  // After init, not inside defineSetup: the store rebuilds the element list once the scene is
  // resolved, which drops anything registered before it.
  followPanel = registerFollowCameraPanel({
    defaultTarget: TARGET.name,
    mode: followMode,
    setMode: (mode) => {
      selectedCase.value = mode
    },
    views: CAMERA_VIEWS,
    // The whole view is a tour of the follow modes, so it starts in one rather than on the
    // scene's static framing.
    followOnStart: true,
    activeView: selectedCaseValue,
    selectView: (value) => {
      selectedCase.value = toCameraCase(value)
    }
  })

  rebuildPathVisuals()
  registerCameraPath()
  pathInteraction.mount()

  // The case watcher only fires on a change, and this view opens already on the sweep.
  if (selectedCase.value === 'path') startIntroPath()
})

/**
 * Dragging a waypoint node in the viewport, through the same composable Timeline and DrawPath
 * use.
 *
 * Only the node half of it is wired: its other half draws a fresh path from a drag across empty
 * ground, which here would wipe the sweep on a stray click. The route is authored by moving the
 * points it already has, or by typing them in the panel.
 */
const pathInteraction = usePathInteraction({
  canvas,
  getCamera: currentCamera,
  onDrawStart: () => {},
  onAddWaypoint: () => {},
  onUpdateWaypoint: (index, position) =>
    debugSceneStore.updatePathWaypoint(PATH_ELEMENT_ID, index, position),
  onDrawEnd: () => redrawRoute(),
  getNodes: () => (pathConfig.showNodes ? pathNodes : [])
})

/**
 * Puts the route on the Camera element, using the same path editor every other path uses.
 *
 * Registered against `Camera` rather than a row of its own: the route is how this camera moves,
 * so editing it belongs where the camera is, and the panel already renders a path section under
 * whichever element owns one.
 */
const registerCameraPath = (): void => {
  /**
   * Whether an edit should send the camera back to the start of the route.
   *
   * Only while the sweep is still running. A finished path has handed the camera to wherever it
   * landed, and replaying it because a slider moved is the camera resetting itself under someone
   * who was only adjusting a number. Re-selecting the view is how a replay is asked for.
   * @returns True while a sweep is in progress
   */
  const sweepInProgress = () => selectedCase.value === 'path' && introPath !== null

  const restartIfRunning = () => {
    rebuildPathVisuals()
    if (sweepInProgress()) startIntroPath()
  }

  debugSceneStore.addPath({
    id: PATH_ELEMENT_ID,
    elementName: 'Camera',
    label: 'Camera path',
    waypoints: pathWaypoints.value,
    config: pathConfig,
    handlers: {
      onAddWaypoint: (position) => {
        pathWaypoints.value = [...pathWaypoints.value, position]
        restartIfRunning()
      },
      onRemoveWaypoint: (index) => {
        pathWaypoints.value = pathWaypoints.value.filter((_unused, at) => at !== index)
        restartIfRunning()
      },
      onUpdateWaypoint: (index, position) => {
        pathWaypoints.value = pathWaypoints.value.map((waypoint, at) =>
          at === index ? position : waypoint
        )
        const node = pathNodes[index]
        if (node) pathUpdateWaypointNodePosition(node, asWaypoint(position))
        redrawRoute()
        if (sweepInProgress()) startIntroPath()
      },
      onReset: () => {
        pathWaypoints.value = INTRO_PATH.map((position) => [...position])
        pathLapReversed = false
        restartIfRunning()
      },
      onToggleVisibility: (hidden) => {
        pathConfig.showPath = !hidden
        pathConfig.showNodes = !hidden
        applyPathVisibility()
      },
      onRemove: () => {
        const scene = toRaw(store.threeScene)
        if (pathLine && scene) pathRemoveVisualization(scene, pathLine)
        if (scene) pathRemoveWaypointNodes(scene, pathNodes)
        pathLine = null
        pathNodes = []
      },
      onConfigChange: (key, value) => {
        Object.assign(pathConfig, { [key]: value })
        if (key === 'showPath' || key === 'showNodes') return applyPathVisibility()
        // Both change the shape of the route rather than how it is travelled.
        if (key === 'loop' || key === 'curved') redrawRoute()
        // Speed and easing change how the route is travelled, not the route itself, so the
        // sweep is restarted rather than the geometry rebuilt.
        if (key !== 'playing' && sweepInProgress()) startIntroPath()
      }
    }
  })
}

onUnmounted(() => {
  canvas.value?.removeEventListener('pointerdown', stopIntroPathOnDrag)
  stopSweepOnPanelMove()
  pathInteraction.unmount()
  followPanel?.teardown()
  followPanel = null
  destroyControls()
  stopIntroPath()
  const scene = toRaw(store.threeScene)
  if (pathLine && scene) pathRemoveVisualization(scene, pathLine)
  if (scene) pathRemoveWaypointNodes(scene, pathNodes)
  nodeGeometry?.dispose()
  nodeMaterial?.dispose()
  nodeGeometry = null
  nodeMaterial = null
  pathLine = null
  pathNodes = []
  debugSceneStore.removePath(PATH_ELEMENT_ID)
  target = null
})
</script>

<template>
  <canvas ref="canvas"></canvas>
</template>
