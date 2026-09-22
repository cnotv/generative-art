/**
 * Renders a side by side video from a clip reproduction test: the original recording, the default
 * character posed by the camera capture, and the same character posed by the preset it recorded,
 * with how far the capture's limbs point from the preset's on every frame.
 *
 * The poses come from `clipReproduction.test.ts`, which writes them when asked:
 *   CLIP_COMPARISON_OUTPUT=comparison.json pnpm vitest run src/views/Tools/RigAnimator/clipReproduction.test.ts
 *
 * Both rigs are rendered in headless Chromium with three.js and the FBX character the Rig Animator
 * loads by default, each turned to face the camera the way the recording shows it.
 *
 * Usage: node scripts/render-clip-comparison.mjs <video> <comparison.json> <output.mp4>
 */
import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { cutFrames, joinFrames } from './video-frames.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const origin = 'http://comparison.local'
const CHARACTER_PATH = '/public/character2.fbx'

const PAGE = `<!doctype html>
<script type="importmap">
  { "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }
</script>
<body style="margin:0"></body>`

const contentType = (path) =>
  path.endsWith('.png')
    ? 'image/png'
    : path.endsWith('.js')
      ? 'text/javascript'
      : 'application/octet-stream'

/** Serve three.js, the character and the recording's frames from disk. */
const serveLocalFiles = (page, frameDirectory) =>
  page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: PAGE })
    const file = path.startsWith('/frames/')
      ? join(frameDirectory, basename(path))
      : path.startsWith('/three/')
        ? join(repositoryRoot, 'node_modules', path)
        : join(repositoryRoot, path)
    return route.fulfill({ contentType: contentType(path), body: readFileSync(file) })
  })

/** Runs in the page: pose the character for every frame of both rigs and composite the panels. */
const renderInPage = async ({ comparison, files, characterPath }) => {
  const THREE = await import('three')
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js')
  const panelWidth = 458
  const panelHeight = 750
  const headerHeight = 56

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(panelWidth, panelHeight)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf1ebdf)
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xcbbd9f, 2.2))
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
  keyLight.position.set(1, 2, 3)
  scene.add(keyLight)

  const character = await new FBXLoader().loadAsync(characterPath)
  const turntable = new THREE.Group()
  turntable.add(character)
  scene.add(turntable)
  const bounds = new THREE.Box3().setFromObject(character)
  const size = bounds.getSize(new THREE.Vector3())
  const centre = bounds.getCenter(new THREE.Vector3())
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(size.y * 0.6, 48),
    new THREE.MeshLambertMaterial({ color: 0xdcd0b6 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = bounds.min.y
  scene.add(floor)
  const camera = new THREE.PerspectiveCamera(30, panelWidth / panelHeight, size.y / 10, size.y * 20)
  const distance = (size.y * 0.62) / Math.tan(THREE.MathUtils.degToRad(15))
  camera.position.set(centre.x, centre.y + size.y * 0.15, centre.z + distance)
  camera.lookAt(centre)

  const bonesByName = new Map()
  character.traverse((node) => {
    if (node.isBone && !bonesByName.has(node.name)) bonesByName.set(node.name, node)
  })
  const FOOT_BONES = [
    'mixamorigLeftToeBase',
    'mixamorigRightToeBase',
    'mixamorigLeftFoot',
    'mixamorigRightFoot'
  ]
  character.updateMatrixWorld(true)
  const restLowestFoot = Math.min(
    ...FOOT_BONES.map((name) => bonesByName.get(name).getWorldPosition(new THREE.Vector3()).y)
  )
  const restRotations = new Map(
    [...bonesByName].map(([name, bone]) => [name, bone.quaternion.clone()])
  )
  const renderPose = (pose, turn) => {
    bonesByName.forEach((bone, name) => {
      const rotation = pose[name]
      if (rotation) bone.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      else bone.quaternion.copy(restRotations.get(name))
    })
    turntable.rotation.y = turn
    turntable.position.y = 0
    turntable.updateMatrixWorld(true)
    // Poses carry rotations only, so a bent leg would sink the foot through the floor.
    const lowestFoot = Math.min(
      ...FOOT_BONES.map((name) => bonesByName.get(name).getWorldPosition(new THREE.Vector3()).y)
    )
    turntable.position.y = restLowestFoot - lowestFoot
    renderer.render(scene, camera)
    return renderer.domElement
  }

  const composite = Object.assign(document.createElement('canvas'), {
    width: panelWidth * 3,
    height: panelHeight + headerHeight
  })
  const context = composite.getContext('2d')
  const label = (text, x, y, size, weight = 'normal') => {
    context.font = `${weight} ${size}px system-ui, sans-serif`
    context.fillStyle = '#3d3a35'
    context.fillText(text, x, y)
  }
  const loadFrame = async (file) => createImageBitmap(await (await fetch(`/frames/${file}`)).blob())

  return comparison.frames.reduce(async (previous, frame, index) => {
    const rendered = await previous
    context.fillStyle = '#f7f3ea'
    context.fillRect(0, 0, composite.width, composite.height)
    context.drawImage(await loadFrame(files[index]), 0, headerHeight, panelWidth, panelHeight)
    context.drawImage(renderPose(frame.capture, comparison.captureTurn), panelWidth, headerHeight)
    context.drawImage(renderPose(frame.preset, comparison.presetTurn), panelWidth * 2, headerHeight)
    label('Recording', 16, 24, 18, '600')
    label('Camera capture', panelWidth + 16, 24, 18, '600')
    label('Running preset', panelWidth * 2 + 16, 24, 18, '600')
    label(`${frame.time.toFixed(2)} s`, 16, 46, 14)
    label(`limbs ${Math.round(frame.limbAngleDegrees)}° off the preset`, panelWidth + 16, 46, 14)
    label('what was on screen', panelWidth * 2 + 16, 46, 14)
    return [...rendered, composite.toDataURL('image/png').split(',')[1]]
  }, Promise.resolve([]))
}

const main = async () => {
  const [video, comparisonPath, output] = process.argv.slice(2)
  if (!video || !comparisonPath || !output) {
    throw new Error('Usage: render-clip-comparison.mjs <video> <comparison.json> <output.mp4>')
  }
  const comparison = JSON.parse(readFileSync(resolve(comparisonPath), 'utf8'))
  const { directory, files } = cutFrames(resolve(video), comparison.framesPerSecond)
  const renderedDirectory = mkdtempSync(join(tmpdir(), 'clip-comparison-'))
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  })
  try {
    const page = await browser.newPage()
    await serveLocalFiles(page, directory)
    await page.goto(`${origin}/`)
    const frames = await page.evaluate(renderInPage, {
      comparison,
      files: files.slice(0, comparison.frames.length),
      characterPath: CHARACTER_PATH
    })
    frames.forEach((base64, index) =>
      writeFileSync(
        join(renderedDirectory, `${String(index + 1).padStart(5, '0')}.png`),
        Buffer.from(base64, 'base64')
      )
    )
    joinFrames(renderedDirectory, comparison.framesPerSecond, resolve(output))
    console.info(`${frames.length} frames written to ${resolve(output)}`)
  } finally {
    await browser.close()
    rmSync(directory, { recursive: true, force: true })
    rmSync(renderedDirectory, { recursive: true, force: true })
  }
}

await main()
