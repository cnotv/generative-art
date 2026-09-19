/**
 * Records a feature demo from a scene file and cuts it into short clips. Each scene opens the
 * running app in its own recorded browser context and performs its steps through the UI the way
 * a person would, marking the stretch worth keeping. That stretch is cut out, sped up, and joined
 * with the other scenes into one summary.
 *
 * Usage:
 *   node scripts/record-demo.mjs <scenes.json>
 *
 * The scene file and the steps it accepts are described in
 * documentation/docs/guides/capturing-documentation-media.md.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const DEFAULT_VIEWPORT = { width: 1100, height: 720 }
const DEFAULT_SPEED = 1
const CLIP_FRAMES_PER_SECOND = 30
/** How often a config value gliding to its target is rewritten, so the change reads as motion. */
const GLIDE_STEP_MILLISECONDS = 60
/** One notch of a mouse wheel, the unit a `wheel` step is scrolled in. */
const WHEEL_NOTCH = 100
const WHEEL_NOTCH_MILLISECONDS = 40
/** A drag passes through this many points, so the camera it moves glides rather than jumps. */
const DRAG_POINT_COUNT = 20
const DRAG_POINT_MILLISECONDS = 20
/** Headless Chromium's software renderer paints white patches over WebGL; the Mac GPU does not. */
const DEFAULT_LAUNCH_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
const SCENE_NAME_PATTERN = /^[\w-]+$/
const CAPTION_ID = 'record-demo-caption'

const fail = (message) => {
  throw new Error(message)
}

const validateScene = (scene, index) => {
  const label = `scene ${index + 1}`
  if (!SCENE_NAME_PATTERN.test(scene?.name ?? ''))
    fail(`${label} needs a name of letters, digits, - or _`)
  if (typeof scene.route !== 'string' || !scene.route.startsWith('/'))
    fail(`${scene.name} needs a route starting with /`)
  if (!Array.isArray(scene.steps) || scene.steps.length === 0) fail(`${scene.name} has no steps`)
  return { speed: DEFAULT_SPEED, ...scene }
}

/**
 * Read a scene file, rejecting one that would fail halfway through a recording. Every path in it
 * is read relative to the file itself, so a scene file copied out of a plan runs from anywhere.
 * @param {string} text The scene file's JSON
 * @param {string} directory The directory the scene file sits in
 * @returns {object} The scenes and their settings, with defaults filled in
 */
export const parseScenes = (text, directory = '.') => {
  const parsed = JSON.parse(text)
  if (typeof parsed.baseUrl !== 'string') fail('the scene file needs a baseUrl')
  if (typeof parsed.output !== 'string') fail('the scene file needs an output directory')
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0)
    fail('the scene file has no scenes')
  const sceneNames = parsed.scenes.map((scene) => scene?.name)
  if (
    parsed.compare &&
    !(parsed.compare.length === 2 && parsed.compare.every((name) => sceneNames.includes(name)))
  )
    fail('compare names two of the scenes, left then right')
  return {
    summary: 'summary',
    viewport: DEFAULT_VIEWPORT,
    launchArgs: DEFAULT_LAUNCH_ARGS,
    ...parsed,
    directory,
    output: resolve(directory, parsed.output),
    scenes: parsed.scenes.map(validateScene)
  }
}

/**
 * The number input behind a Config panel field, named the way the panel shows it: a section and
 * its control, `Upper Arms > Length`, or a control alone when it sits outside any section.
 * @param {string} path The field's section and control labels
 * @returns {string} A CSS selector for the field's number input
 */
export const configFieldSelector = (path) => {
  const [control, section] = path
    .split('>')
    .map((part) => part.trim())
    .reverse()
  const field = `label:has-text("${control}:") input[type="number"]`
  return section ? `.config-controls__section:has(> :text-is("${section}")) ${field}` : field
}

/**
 * The values a field passes through on its way to a target, one per glide step, ending exactly on
 * the target. A slider that jumps straight there shows nothing in a video but a cut.
 * @param {number} from Where the field starts
 * @param {number} to Where it ends
 * @param {number} over How long the glide should take, in milliseconds
 * @returns {number[]} Every value to write, in order
 */
export const glideValues = (from, to, over) => {
  const stepCount = Math.max(1, Math.round(over / GLIDE_STEP_MILLISECONDS))
  return Array.from({ length: stepCount }, (_, index) =>
    index === stepCount - 1
      ? to
      : Number((from + ((to - from) * (index + 1)) / stepCount).toFixed(4))
  )
}

/**
 * The stretch of a recording a scene asked to keep, between its start and end marks, or all of
 * it where a mark is missing.
 * @param {{ start?: number, end?: number }} marks Seconds into the recording each mark was set
 * @param {number} recordedSeconds How long the whole recording ran
 * @returns {{ start: number, duration: number }} Where to cut, in seconds
 */
export const cutWindow = (marks, recordedSeconds) => {
  const start = marks.start ?? 0
  const end = marks.end ?? recordedSeconds
  if (end <= start) fail(`the end mark (${end}s) comes before the start mark (${start}s)`)
  return { start, duration: end - start }
}

/**
 * The ffmpeg arguments that cut one scene to its window and speed it up. The window is applied to
 * the input, before the speed-up, so it is measured in the recording's own seconds.
 * @param {{ source: string, target: string, window: { start: number, duration: number }, speed: number, width: number }} clip
 * @returns {string[]} The arguments, in order
 */
export const clipArguments = ({ source, target, window, speed, width }) => [
  '-y',
  '-loglevel',
  'error',
  '-ss',
  window.start.toFixed(2),
  '-t',
  window.duration.toFixed(2),
  '-i',
  source,
  '-vf',
  `setpts=PTS/${speed},fps=${CLIP_FRAMES_PER_SECOND},scale=${width}:-2`,
  '-an',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '24',
  target
]

/**
 * The ffmpeg arguments that play two finished clips side by side, the way a before and an after
 * are best compared: a tool that frames its camera on the model shows each at the same size on
 * its own, which hides exactly the change being shown.
 * @param {{ left: string, right: string, target: string, width: number }} comparison
 * @returns {string[]} The arguments, in order
 */
export const compareArguments = ({ left, right, target, width }) => [
  '-y',
  '-loglevel',
  'error',
  '-i',
  left,
  '-i',
  right,
  '-filter_complex',
  `[0:v][1:v]hstack=inputs=2,scale=${width}:-2`,
  '-an',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '24',
  target
]

/**
 * A wheel scroll split into notches, the way a real wheel delivers it: a camera control that
 * zooms a step per wheel event barely moves for one large event.
 * @param {number} delta The total scroll, negative towards the viewer
 * @returns {number[]} One delta per notch, adding up to the total
 */
export const wheelNotches = (delta) => {
  const notchCount = Math.max(1, Math.round(Math.abs(delta) / WHEEL_NOTCH))
  return Array.from({ length: notchCount }, () => delta / notchCount)
}

/**
 * The points a drag passes through between its two ends, excluding the start and ending on the
 * target.
 * @param {[number, number]} from Where the drag starts, in viewport pixels
 * @param {[number, number]} to Where it ends
 * @returns {[number, number][]} Every point to move through, in order
 */
export const dragPoints = ([fromX, fromY], [toX, toY]) =>
  Array.from({ length: DRAG_POINT_COUNT }, (_, index) => {
    const progress = (index + 1) / DRAG_POINT_COUNT
    return [fromX + (toX - fromX) * progress, fromY + (toY - fromY) * progress]
  })

const inSequence = (items, run) =>
  items.reduce((previous, item) => previous.then(() => run(item)), Promise.resolve())

const locate = (page, target) =>
  typeof target === 'string'
    ? page.locator(target).first()
    : page.getByRole(target.role, { name: target.name, exact: true }).first()

const showCaption = (page, text) =>
  page.evaluate(
    ({ id, text }) => {
      const caption =
        document.getElementById(id) ?? Object.assign(document.createElement('div'), { id })
      Object.assign(caption.style, {
        position: 'fixed',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '8px 16px',
        borderRadius: '8px',
        background: 'rgba(24, 24, 32, 0.8)',
        color: '#fff',
        font: '600 18px system-ui, sans-serif',
        pointerEvents: 'none'
      })
      caption.textContent = text
      document.body.append(caption)
    },
    { id: CAPTION_ID, text }
  )

const glideField = async (page, selector, to, over) => {
  const field = page.locator(selector).first()
  await field.scrollIntoViewIfNeeded()
  const from = Number(await field.inputValue())
  await inSequence(glideValues(from, to, over), async (value) => {
    await field.fill(String(value))
    await field.dispatchEvent('input')
    await page.waitForTimeout(GLIDE_STEP_MILLISECONDS)
  })
}

const scrollWheel = async (page, delta, at) => {
  await page.mouse.move(...at)
  await inSequence(wheelNotches(delta), async (notch) => {
    await page.mouse.wheel(0, notch)
    await page.waitForTimeout(WHEEL_NOTCH_MILLISECONDS)
  })
}

const dragMouse = async (page, [from, to], button) => {
  await page.mouse.move(...from)
  await page.mouse.down({ button })
  await inSequence(dragPoints(from, to), async (point) => {
    await page.mouse.move(...point)
    await page.waitForTimeout(DRAG_POINT_MILLISECONDS)
  })
  await page.mouse.up({ button })
}

const STEP_RUNNERS = {
  wait: (page, step) => page.waitForTimeout(step.wait),
  caption: (page, step) => showCaption(page, step.caption),
  click: (page, step) => locate(page, step.click).click(),
  select: async (page, step) => {
    await page.getByRole('combobox').filter({ hasText: step.select }).first().click()
    await page.getByRole('option', { name: step.option, exact: true }).click()
  },
  upload: (page, step, settings) =>
    page
      .locator(step.into ?? 'input[type="file"]')
      .first()
      .setInputFiles(resolve(settings.directory, step.upload)),
  download: async (page, step, settings) => {
    const download = page.waitForEvent('download')
    await locate(page, step.download).click()
    await (await download).saveAs(resolve(settings.directory, step.saveAs))
  },
  wheel: (page, step) => scrollWheel(page, step.wheel, step.at),
  drag: (page, step) => dragMouse(page, step.drag, step.button ?? 'left'),
  config: (page, step) =>
    glideField(page, configFieldSelector(step.config), step.to, step.over ?? 0)
}

const runStep = (page, step, settings) => {
  const kind = Object.keys(STEP_RUNNERS).find((name) => name in step)
  return kind
    ? STEP_RUNNERS[kind](page, step, settings)
    : fail(`unknown step ${JSON.stringify(step)}`)
}

const recordScene = async (browser, scene, settings, rawDirectory) => {
  const context = await browser.newContext({
    viewport: settings.viewport,
    recordVideo: { dir: rawDirectory, size: settings.viewport },
    acceptDownloads: true
  })
  const page = await context.newPage()
  const startedAt = Date.now()
  const elapsed = () => (Date.now() - startedAt) / 1000
  await page.goto(`${settings.baseUrl}${scene.route}`)
  if (scene.caption) await showCaption(page, scene.caption)

  const marks = await scene.steps.reduce(async (pending, step) => {
    const marked = await pending
    if (step.mark) return { ...marked, [step.mark]: elapsed() }
    await runStep(page, step, settings)
    return marked
  }, Promise.resolve({}))

  const recordedSeconds = elapsed()
  const video = page.video()
  await context.close()
  const rawPath = join(rawDirectory, `${scene.name}.webm`)
  await video.saveAs(rawPath)
  return { marks, recordedSeconds, rawPath }
}

const runFfmpeg = (argumentList) => execFileSync('ffmpeg', argumentList, { stdio: 'inherit' })

const cutScene = (scene, recording, settings) => {
  const target = join(settings.output, `${scene.name}.mp4`)
  runFfmpeg(
    clipArguments({
      source: recording.rawPath,
      target,
      window: cutWindow(recording.marks, recording.recordedSeconds),
      speed: scene.speed,
      width: settings.viewport.width
    })
  )
  return target
}

const joinClips = (clips, settings, workDirectory) => {
  const list = join(workDirectory, 'clips.txt')
  writeFileSync(list, clips.map((clip) => `file '${resolve(clip)}'`).join('\n'))
  const summary = join(settings.output, `${settings.summary}.mp4`)
  runFfmpeg([
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c',
    'copy',
    summary
  ])
  const summaryWebm = join(settings.output, `${settings.summary}.webm`)
  runFfmpeg([
    '-y',
    '-loglevel',
    'error',
    '-i',
    summary,
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '40',
    '-b:v',
    '0',
    '-an',
    summaryWebm
  ])
  return [summary, summaryWebm]
}

const compareClips = (settings) => {
  const [left, right] = settings.compare.map((name) => join(settings.output, `${name}.mp4`))
  const target = join(settings.output, `${settings.summary}-compare.mp4`)
  runFfmpeg(compareArguments({ left, right, target, width: settings.viewport.width }))
  return target
}

const main = async () => {
  const [sceneFile] = process.argv.slice(2)
  if (!sceneFile) fail('usage: node scripts/record-demo.mjs <scenes.json>')
  const settings = parseScenes(readFileSync(sceneFile, 'utf8'), dirname(resolve(sceneFile)))
  mkdirSync(settings.output, { recursive: true })
  const workDirectory = mkdtempSync(join(tmpdir(), 'record-demo-'))

  const browser = await chromium.launch({ args: settings.launchArgs })
  const clips = await settings.scenes.reduce(async (pending, scene) => {
    const done = await pending
    console.error(`Recording ${scene.name}`)
    const recording = await recordScene(browser, scene, settings, workDirectory)
    return [...done, cutScene(scene, recording, settings)]
  }, Promise.resolve([]))
  await browser.close()

  const summaries = joinClips(clips, settings, workDirectory)
  const comparison = settings.compare ? [compareClips(settings)] : []
  console.log([...clips, ...summaries, ...comparison].join('\n'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
