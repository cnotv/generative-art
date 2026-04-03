<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useDebugSceneStore } from '@/stores/debugScene'
import RAPIER from '@dimforge/rapier3d-compat'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { createZigzagTexture } from '@webgamekit/threejs'
import grassTextureImg from '@/assets/images/textures/grass.jpg'

const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const canvas = ref(null)
const canvas1 = ref(null)
const canvas2 = ref(null)
const canvas3 = ref(null)
const canvas4 = ref(null)
let scene, camera, renderer, world, clock
let cameras = []
let renderers = []
let orbitControls
const isSplitScreen = ref(true)
let geekoMixer,
  geekoAction,
  characterController,
  geekoRigidBody,
  bugRigidBody,
  bugMesh,
  geekoCollider,
  bugMixer
let geekoObject
const autoTracking = ref(true)
let jumpVelocity = 0
const cameraView = ref('default') // 'default', 'top', 'left', 'right'
const cameraType = ref('perspective') // 'perspective', 'orthographic', 'fisheye', 'cinematic', 'orbit'
const cubeSize = 2 // Configurable cube size
const gridGap = 2 // Gap equals cube size
const obstacles = [] // Store obstacle positions
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false
}

const score = () => {
  console.warn('Score!')
}

const findValidPosition = () => {
  const validPos = Array.from({ length: 50 }, () => {
    const x = Math.random() * 20 - 10
    const z = Math.random() * 20 - 10
    const clear = obstacles.every((obs) => Math.hypot(obs.x - x, obs.z - z) > cubeSize * 1.5)
    return clear ? { x, y: 1, z } : null
  }).find(Boolean)
  return validPos ?? { x: Math.random() * 20 - 10, y: 1, z: Math.random() * 20 - 10 }
}

const setupLights = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 2)
  scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4.0)
  directionalLight.position.set(20, 30, 20)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 4096
  directionalLight.shadow.mapSize.height = 4096
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 500
  directionalLight.shadow.camera.left = -50
  directionalLight.shadow.camera.right = 50
  directionalLight.shadow.camera.top = 50
  directionalLight.shadow.camera.bottom = -50
  directionalLight.shadow.bias = -0.0001
  directionalLight.shadow.radius = 1
  scene.add(directionalLight)
}

const setupGround = async (gltfLoader) => {
  const groundSize = 10000
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize)
  const zigzagMaterial = new THREE.MeshStandardMaterial({
    map: createZigzagTexture({
      size: 32,
      backgroundColor: '#1a3311',
      zigzagColor: '#0d1a08',
      zigzagHeight: 16,
      zigzagWidth: 16,
      primaryThickness: 2,
      repeatX: groundSize / 2,
      repeatY: groundSize / 2
    }),
    roughness: 0.8,
    metalness: 0.2
  })
  const textureLoader = new THREE.TextureLoader()
  const grassTexture = textureLoader.load(grassTextureImg)
  grassTexture.wrapS = THREE.RepeatWrapping
  grassTexture.wrapT = THREE.RepeatWrapping
  grassTexture.repeat.set(groundSize / 10, groundSize / 10)
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.9,
    metalness: 0.1,
    color: 0x808080
  })
  void zigzagMaterial
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.receiveShadow = true
  scene.add(groundMesh)
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
  const groundBody = world.createRigidBody(groundBodyDesc)
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(groundSize / 2, 0.1, groundSize / 2)
  world.createCollider(groundColliderDesc, groundBody)

  const numberCubes = 20
  await Promise.all(
    Array.from({ length: numberCubes }, async () => {
      const gridX = Math.floor(Math.random() * 10) - 5
      const gridZ = Math.floor(Math.random() * 10) - 5
      const x = gridX * (cubeSize + gridGap)
      const z = gridZ * (cubeSize + gridGap)
      if (Math.abs(x) < 3 && Math.abs(z) < 3) return
      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.load('/sand_block.glb', resolve, undefined, reject)
      })
      const sandBlockMesh = gltf.scene
      sandBlockMesh.scale.set(0.01, 0.01, 0.01)
      sandBlockMesh.position.set(x, cubeSize / 2, z)
      sandBlockMesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      scene.add(sandBlockMesh)
      const blockBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, cubeSize / 2, z)
      const blockBody = world.createRigidBody(blockBodyDesc)
      const blockColliderDesc = RAPIER.ColliderDesc.cuboid(cubeSize / 2, cubeSize / 2, cubeSize / 2)
      world.createCollider(blockColliderDesc, blockBody)
      obstacles.push({ x, z })
    })
  )
}

const loadGeekoModel = async (loader) => {
  const geekoLoaded = await new Promise((resolve, reject) => {
    loader.load('/chameleon.fbx', (object) => resolve(object), undefined, reject)
  })
  geekoLoaded.position.set(0, -0.75, 0)
  geekoLoaded.scale.set(0.05, 0.05, 0.05)
  geekoLoaded.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.material) {
        const oldMaterial = child.material
        child.material = new THREE.MeshLambertMaterial({
          color: oldMaterial.color || 0xffffff,
          map: oldMaterial.map,
          flatShading: false
        })
      }
    }
  })
  scene.add(geekoLoaded)
  return geekoLoaded
}

const setupGeekoPhysics = () => {
  const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
  geekoRigidBody = world.createRigidBody(rigidBodyDesc)
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3)
  geekoCollider = world.createCollider(colliderDesc, geekoRigidBody)
  characterController = world.createCharacterController(0.01)
  characterController.enableSnapToGround(0.5)
}

const loadBug = async (gltfLoader) => {
  const bugPos = findValidPosition()
  const waspGltf = await new Promise((resolve, reject) => {
    gltfLoader.load('/wasp.glb', resolve, undefined, reject)
  })
  bugMesh = waspGltf.scene
  bugMesh.position.set(bugPos.x, bugPos.y, bugPos.z)
  bugMesh.scale.set(1, 1, 1)
  bugMesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  scene.add(bugMesh)
  if (waspGltf.animations && waspGltf.animations.length > 0) {
    bugMixer = new THREE.AnimationMixer(bugMesh)
    const bugAction = bugMixer.clipAction(waspGltf.animations[0])
    bugAction.play()
  }
  const bugBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(bugPos.x, bugPos.y, bugPos.z)
  bugRigidBody = world.createRigidBody(bugBodyDesc)
  const bugColliderDesc = RAPIER.ColliderDesc.ball(0.5)
  world.createCollider(bugColliderDesc, bugRigidBody)
}

const loadGeekoAnimations = async (loader) => {
  const animObject = await new Promise((resolve, reject) => {
    loader.load('/chameleon_animations.fbx', (object) => resolve(object), undefined, reject)
  })
  geekoMixer = new THREE.AnimationMixer(geekoObject)
  if (animObject.animations.length > 0) {
    const clip = animObject.animations.find((a) => a.name === 'Idle_A') || animObject.animations[0]
    geekoAction = geekoMixer.clipAction(clip)
    geekoAction.play()
  }
}

const setupCameras = (aspect, frustumSize, verticalOffset, frustumSize2, verticalOffset2) => {
  const cameraConfigs = [
    {
      name: 'perspective',
      camera: new THREE.PerspectiveCamera(75, aspect, 0.1, 1000),
      position: [0, 5, 20]
    },
    {
      name: 'orthographic-preset',
      camera: new THREE.OrthographicCamera(
        (frustumSize2 * aspect) / -2,
        (frustumSize2 * aspect) / 2,
        frustumSize2 / 2 + verticalOffset2,
        frustumSize2 / -2 + verticalOffset2,
        0.1,
        1000
      ),
      position: [0, 5, 20],
      frustumSize: frustumSize2,
      verticalOffset: verticalOffset2
    },
    {
      name: 'fisheye',
      camera: new THREE.PerspectiveCamera(120, aspect, 0.1, 1000),
      position: [0, 5, 20]
    },
    {
      name: 'orbit',
      camera: new THREE.PerspectiveCamera(75, aspect, 0.1, 1000),
      position: [0, 10, 15]
    },
    {
      name: 'cinematic',
      camera: new THREE.PerspectiveCamera(35, aspect, 0.1, 1000),
      position: [0, 5, 20]
    },
    {
      name: 'orthographic',
      camera: new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2 + verticalOffset,
        frustumSize / -2 + verticalOffset,
        0.1,
        1000
      ),
      position: [10, 12, 10],
      lookAt: [0, -verticalOffset, 0]
    }
  ]
  return cameraConfigs.map((config) => {
    config.camera.position.set(...config.position)
    if (config.lookAt) {
      config.camera.lookAt(...config.lookAt)
    }
    return { ...config }
  })
}

const getAutoTrackDirection = (position) => {
  const bugPosition = bugRigidBody.translation()
  const direction = new THREE.Vector3(
    bugPosition.x - position.x,
    0,
    bugPosition.z - position.z
  ).normalize()
  const lookAheadDistribution = 2
  const futureX = position.x + direction.x * lookAheadDistribution
  const futureZ = position.z + direction.z * lookAheadDistribution
  const obstacleAhead = obstacles.some((obs) => {
    const distribution = Math.hypot(obs.x - futureX, obs.z - futureZ)
    return distribution < cubeSize
  })
  if (obstacleAhead && position.y <= 0.1) {
    jumpVelocity = 0.25
  }
  return direction
}

const getManualDirection = () => {
  const currentRotation = geekoObject.rotation.y
  let moveForward = 0
  if (keys.w) moveForward = 1
  if (keys.s) moveForward = -1
  const direction = new THREE.Vector3(0, 0, 0)
  if (moveForward !== 0) {
    direction.x = Math.sin(currentRotation) * moveForward
    direction.z = Math.cos(currentRotation) * moveForward
  }
  const rotationSpeed = 0.05
  if (keys.a) geekoObject.rotation.y += rotationSpeed
  if (keys.d) geekoObject.rotation.y -= rotationSpeed
  return direction
}

const getFollowingCameraPosition = (geekoPos) => {
  const viewPositions = {
    top: [geekoPos.x, geekoPos.y + 15, geekoPos.z],
    left: [geekoPos.x - 15, geekoPos.y + 5, geekoPos.z],
    right: [geekoPos.x + 15, geekoPos.y + 5, geekoPos.z]
  }
  return viewPositions[cameraView.value] ?? [geekoPos.x, geekoPos.y + 5, geekoPos.z + 20]
}

const updateCameraForName = (camConfig, geekoPos) => {
  const cam = camConfig.camera
  const FOLLOWING_CAMERAS = new Set(['perspective', 'fisheye', 'orthographic-preset'])
  if (FOLLOWING_CAMERAS.has(camConfig.name)) {
    cam.position.set(...getFollowingCameraPosition(geekoPos))
    cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z)
  } else if (camConfig.name === 'orthographic') {
    cam.position.set(geekoPos.x + 10, geekoPos.y + 12, geekoPos.z + 10)
    cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z)
  } else if (camConfig.name === 'orbit' && orbitControls) {
    orbitControls.target.set(geekoPos.x, geekoPos.y, geekoPos.z)
    orbitControls.update()
  } else if (camConfig.name === 'cinematic') {
    cam.position.set(geekoPos.x, geekoPos.y + 3, geekoPos.z + 10)
    cam.lookAt(geekoPos.x, geekoPos.y, geekoPos.z)
  }
}

const checkBugCollision = (newPos) => {
  const bugPosition = bugRigidBody.translation()
  const distance = Math.sqrt(
    Math.pow(bugPosition.x - newPos.x, 2) + Math.pow(bugPosition.z - newPos.z, 2)
  )
  if (distance < 1.0) {
    score()
    const newBugPos = findValidPosition()
    bugRigidBody.setTranslation(newBugPos, true)
    bugMesh.position.copy(bugRigidBody.translation())
  }
}

const applyJumpAndGravity = (isGrounded) => {
  if (keys.space && isGrounded && !autoTracking.value) {
    jumpVelocity = 0.2
  }
  if (!isGrounded || jumpVelocity > 0) {
    jumpVelocity -= 0.01
  } else {
    jumpVelocity = -0.01
  }
}

const renderFrame = () => {
  if (isSplitScreen.value) {
    const splitScreenCameras = [0, 1, 5, 3]
    renderers.forEach((rend, index) => {
      const cameraIndex = splitScreenCameras[index]
      if (cameras[cameraIndex]) {
        rend.render(scene, cameras[cameraIndex].camera)
      }
    })
  } else {
    renderer.render(scene, camera)
  }
}

const runAnimationLoop = (delta, position) => {
  world.step()
  const direction = autoTracking.value ? getAutoTrackDirection(position) : getManualDirection()

  applyJumpAndGravity(position.y <= 0.1)

  const speed = 0.1
  const movement = { x: direction.x * speed, y: jumpVelocity, z: direction.z * speed }
  characterController.computeColliderMovement(geekoCollider, movement)
  const correctedMovement = characterController.computedMovement()
  const newPos = {
    x: position.x + correctedMovement.x,
    y: Math.max(0, position.y + correctedMovement.y),
    z: position.z + correctedMovement.z
  }

  geekoRigidBody.setNextKinematicTranslation(newPos)
  geekoObject.position.set(newPos.x, newPos.y, newPos.z)

  if (autoTracking.value && direction.length() > 0.01) {
    geekoObject.rotation.y = Math.atan2(direction.x, direction.z)
  }

  checkBugCollision(newPos)
  if (geekoMixer) geekoMixer.update(delta)
  if (bugMixer) bugMixer.update(delta)

  cameras.forEach((camConfig) => updateCameraForName(camConfig, geekoObject.position))
  renderFrame()
}

const init = async () => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)

  const viewportWidth = isSplitScreen.value ? window.innerWidth / 2 : window.innerWidth
  const viewportHeight = isSplitScreen.value ? window.innerHeight / 2 : window.innerHeight
  const aspect = viewportWidth / viewportHeight
  const frustumSize = 40
  const verticalOffset = 15
  const frustumSize2 = 30
  const verticalOffset2 = 10

  cameras = setupCameras(aspect, frustumSize, verticalOffset, frustumSize2, verticalOffset2)
  camera = cameras[0].camera

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  const canvasReferences = [canvas1, canvas2, canvas3, canvas4]
  renderers = canvasReferences.map((canvasReference) => {
    const rend = new THREE.WebGLRenderer({ canvas: canvasReference.value, antialias: true })
    rend.setSize(viewportWidth, viewportHeight)
    rend.shadowMap.enabled = true
    return rend
  })

  const orbitCam = cameras.find((c) => c.name === 'orbit')
  if (orbitCam) {
    orbitControls = new OrbitControls(
      orbitCam.camera,
      isSplitScreen.value ? renderers[3].domElement : renderer.domElement
    )
    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.05
    orbitControls.enabled = isSplitScreen.value || cameraType.value === 'orbit'
  }

  setupLights()

  await RAPIER.init()
  world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })

  const gltfLoader = new GLTFLoader()
  await setupGround(gltfLoader)

  const loader = new FBXLoader()
  geekoObject = await loadGeekoModel(loader)
  setupGeekoPhysics()
  await loadBug(gltfLoader)
  await loadGeekoAnimations(loader)

  clock = new THREE.Clock()
  registerSceneElements(
    camera,
    scene.children.filter((c) => !cameras.some((cam) => cam.camera === c))
  )

  const animate = () => {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const position = geekoRigidBody.translation()
    runAnimationLoop(delta, position)
  }
  animate()
}

const onWindowResize = () => {
  const viewportWidth = isSplitScreen.value ? window.innerWidth / 2 : window.innerWidth
  const viewportHeight = isSplitScreen.value ? window.innerHeight / 2 : window.innerHeight
  const aspect = viewportWidth / viewportHeight
  const frustumSize = 40
  const verticalOffset = 15

  cameras.forEach((camConfig) => {
    const cam = camConfig.camera
    if (cam.isPerspectiveCamera) {
      cam.aspect = aspect
      cam.updateProjectionMatrix()
    } else if (cam.isOrthographicCamera) {
      const fs = camConfig.frustumSize || frustumSize
      const vo = camConfig.verticalOffset || verticalOffset
      cam.left = (fs * aspect) / -2
      cam.right = (fs * aspect) / 2
      cam.top = fs / 2 + vo
      cam.bottom = fs / -2 + vo
      cam.updateProjectionMatrix()
    }
  })

  if (isSplitScreen.value) {
    renderers.forEach((rend) => rend.setSize(viewportWidth, viewportHeight))
  } else if (renderer) {
    renderer.setSize(viewportWidth, viewportHeight)
  }
}

const selectCamera = (name, enableOrbit) => {
  isSplitScreen.value = false
  cameraType.value = name
  camera = cameras.find((c) => c.name === name)?.camera
  if (orbitControls) orbitControls.enabled = enableOrbit
  onWindowResize()
}

const handleArrowKeys = (key) => {
  const viewMap = {
    ArrowUp: 'top',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'default'
  }
  if (viewMap[key]) cameraView.value = viewMap[key]
}

const CAMERA_KEY_MAP = {
  1: ['perspective', false],
  2: ['orthographic-preset', false],
  3: ['fisheye', false],
  4: ['orbit', true],
  5: ['cinematic', false],
  6: ['orthographic', false]
}

const handleMovementKeys = (key, e) => {
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    keys[key] = true
  }
  if (key === ' ') {
    keys.space = true
    e.preventDefault()
  }
  if (key === 'enter') {
    autoTracking.value = !autoTracking.value
    console.warn('Auto-tracking:', autoTracking.value ? 'ON' : 'OFF')
  }
}

const handleCameraKeys = (eventKey) => {
  if (!isSplitScreen.value) handleArrowKeys(eventKey)
  if (CAMERA_KEY_MAP[eventKey]) {
    const [name, enableOrbit] = CAMERA_KEY_MAP[eventKey]
    selectCamera(name, enableOrbit)
  }
  if (eventKey === '7' && !isSplitScreen.value) {
    isSplitScreen.value = true
    if (orbitControls) orbitControls.enabled = true
    onWindowResize()
  }
}

const onKeyDown = (e) => {
  handleMovementKeys(e.key.toLowerCase(), e)
  handleCameraKeys(e.key)
}

const onKeyUp = (e) => {
  const key = e.key.toLowerCase()
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    keys[key] = false
  }
  if (key === ' ') {
    keys.space = false
  }
}

onMounted(async () => {
  await init()
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  clearSceneElements()
})
</script>

<template>
  <!-- Single camera mode -->
  <canvas
    ref="canvas"
    class="single-canvas"
    :style="{ display: isSplitScreen ? 'none' : 'block' }"
  ></canvas>

  <!-- Split screen mode -->
  <div class="split-screen-container" :style="{ display: isSplitScreen ? 'grid' : 'none' }">
    <div class="viewport">
      <canvas ref="canvas1"></canvas>
      <div class="camera-label">Perspective (75° FOV)</div>
    </div>
    <div class="viewport">
      <canvas ref="canvas2"></canvas>
      <div class="camera-label">Orthographic (Isometric)</div>
    </div>
    <div class="viewport">
      <canvas ref="canvas3"></canvas>
      <div class="camera-label">Orthographic (Following)</div>
    </div>
    <div class="viewport">
      <canvas ref="canvas4"></canvas>
      <div class="camera-label">Orbit (Mouse Control)</div>
    </div>
  </div>

  <!-- Instructions overlay -->
  <div class="instructions">
    <div>Mode: {{ isSplitScreen ? 'Split Screen' : cameraType }} | View: {{ cameraView }}</div>
    <div>Press 7: Toggle Split Screen ({{ isSplitScreen ? 'ON' : 'OFF' }})</div>
    <div v-if="!isSplitScreen">Press 1-6: Switch Camera | Arrows: Change View</div>
    <div>WASD: Move | SPACE: Jump | ENTER: Auto-track ({{ autoTracking ? 'ON' : 'OFF' }})</div>
  </div>
</template>

<style scoped>
.single-canvas {
  position: relative;
  z-index: 0;
  width: 100vw;
  height: 100vh;
}

.split-screen-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.viewport {
  position: relative;
  border: 1px solid #333;
  overflow: hidden;
}

.camera-label {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  font-family: monospace;
}

.instructions {
  position: fixed;
  bottom: 10px;
  left: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
}
</style>
