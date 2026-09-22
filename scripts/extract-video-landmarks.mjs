/**
 * Runs MediaPipe Pose and Face Landmarker over every frame of a video and writes what they read
 * as a clip fixture, so a recording can be replayed through the Rig Animator's camera retarget in
 * a unit test without a browser or a camera.
 *
 * The detectors only run in a browser, so they run in headless Chromium. Playwright's Chromium
 * has no H.264 decoder, so ffmpeg cuts the video into PNG frames first and the page reads those
 * one at a time, timestamped at the video's own frame rate: the pose detector runs in VIDEO mode,
 * tracking from one frame to the next exactly as the live capture does.
 *
 * Usage: node scripts/extract-video-landmarks.mjs <video> <output.json> [--fps 30] [--full]
 *   --full uses pose_landmarker_full instead of the lite model the app ships with.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const visionPackage = join(repositoryRoot, 'node_modules', '@mediapipe', 'tasks-vision')
const modelBase = 'https://storage.googleapis.com/mediapipe-models'
const poseModelUrl = (variant) =>
  `${modelBase}/pose_landmarker/pose_landmarker_${variant}/float16/1/pose_landmarker_${variant}.task`
const faceModelUrl = `${modelBase}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
const origin = 'http://landmarks.local'

const parseArguments = (argv) => {
  const [video, output] = argv.filter(
    (argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--fps'
  )
  const fpsIndex = argv.indexOf('--fps')
  if (!video || !output)
    throw new Error('Usage: extract-video-landmarks.mjs <video> <output.json> [--fps 30] [--full]')
  return {
    video: resolve(video),
    output: resolve(output),
    framesPerSecond: fpsIndex >= 0 ? Number(argv[fpsIndex + 1]) : 30,
    poseVariant: argv.includes('--full') ? 'full' : 'lite'
  }
}

const cutFrames = (video, framesPerSecond) => {
  const directory = mkdtempSync(join(tmpdir(), 'landmark-frames-'))
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    `fps=${framesPerSecond}`,
    join(directory, '%05d.png')
  ])
  return {
    directory,
    files: readdirSync(directory)
      .filter((name) => name.endsWith('.png'))
      .sort()
  }
}

const contentType = (path) =>
  path.endsWith('.wasm')
    ? 'application/wasm'
    : path.endsWith('.png')
      ? 'image/png'
      : 'text/javascript'

/** Serve the detector bundle, its wasm and the frames from disk; let the model files through. */
const serveLocalFiles = (page, frameDirectory) =>
  page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/')
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' })
    const file = path.startsWith('/frames/')
      ? join(frameDirectory, basename(path))
      : join(visionPackage, path)
    return route.fulfill({ contentType: contentType(path), body: readFileSync(file) })
  })

const round = (value) => Math.round(value * 10000) / 10000
/** One landmark per line, the way the other clip fixtures read. */
const formatFixture = (fixture) =>
  `${JSON.stringify(fixture, null, 2).replace(/{\s+("x"[^{}]*?)\s+}/g, (_, fields) => `{ ${fields.replace(/\s*\n\s*/g, ' ')} }`)}\n`
const roundLandmark = ({ x, y, z, visibility }) => ({
  x: round(x),
  y: round(y),
  z: round(z),
  visibility: round(visibility)
})

/** Runs in the page: load both detectors, read every frame in order, return the raw readings. */
const detectInPage = async ({ files, framesPerSecond, poseModel, faceModel }) => {
  const { FilesetResolver, PoseLandmarker, FaceLandmarker } = await import('/vision_bundle.mjs')
  const fileset = await FilesetResolver.forVisionTasks('/wasm')
  const pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: poseModel, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: 1
  })
  const face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: faceModel, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFacialTransformationMatrixes: true
  })
  const readFrame = async (file, index) => {
    const image = await createImageBitmap(await (await fetch(`/frames/${file}`)).blob())
    const time = index / framesPerSecond
    const poseResult = pose.detectForVideo(image, time * 1000)
    const faceResult = face.detect(image)
    return {
      time,
      imageSize: { width: image.width, height: image.height },
      bodyLandmarks: poseResult.worldLandmarks[0] ?? null,
      faceMatrix: faceResult.facialTransformationMatrixes?.[0]?.data ?? null
    }
  }
  return files.reduce(
    async (previous, file, index) => [...(await previous), await readFrame(file, index)],
    Promise.resolve([])
  )
}

const main = async () => {
  const { video, output, framesPerSecond, poseVariant } = parseArguments(process.argv.slice(2))
  const { directory, files } = cutFrames(video, framesPerSecond)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await serveLocalFiles(page, directory)
    await page.goto(`${origin}/`)
    const readings = await page.evaluate(detectInPage, {
      files,
      framesPerSecond,
      poseModel: poseModelUrl(poseVariant),
      faceModel: faceModelUrl
    })
    const frames = readings.map((reading) => ({
      time: round(reading.time),
      bodyLandmarks: reading.bodyLandmarks?.map(roundLandmark) ?? null,
      handLandmarks: {},
      faceMatrix: reading.faceMatrix?.map(round) ?? null
    }))
    const detected = frames.filter((frame) => frame.bodyLandmarks).length
    writeFileSync(
      output,
      formatFixture({
        source: `${basename(video)}, MediaPipe pose_landmarker_${poseVariant} (VIDEO mode) and face_landmarker, ${framesPerSecond} fps`,
        imageSize: readings[0]?.imageSize ?? null,
        frames
      })
    )
    console.info(`${detected} of ${frames.length} frames carry a body, written to ${output}`)
  } finally {
    await browser.close()
    rmSync(directory, { recursive: true, force: true })
  }
}

await main()
