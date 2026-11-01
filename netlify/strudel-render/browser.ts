import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser, Download, Page } from 'playwright'
import {
  STRUDEL_ACTION_TIMEOUT_MS,
  STRUDEL_BROWSER_LAUNCH_TIMEOUT_MS,
  STRUDEL_CHROMIUM_PACK_URL,
  STRUDEL_CONTENT_TYPES,
  STRUDEL_DOWNLOAD_TIMEOUT_MS,
  STRUDEL_EDITOR_ROUTE,
  STRUDEL_EDITOR_STORAGE_KEY,
  STRUDEL_EDITOR_URL_ENV,
  STRUDEL_ERROR_MESSAGE_MAX,
  STRUDEL_FILE_EXTENSIONS,
  STRUDEL_HTTP_STATUS,
  STRUDEL_NAVIGATION_TIMEOUT_MS,
  STRUDEL_RENDER_NAME,
  STRUDEL_RENDER_SECONDS_MAX,
  STRUDEL_RENDER_TIMEOUT_MS,
  STRUDEL_SAMPLE_HOSTS,
  STRUDEL_SAMPLE_RATE_LABELS,
  STRUDEL_SAMPLE_RATES,
  STRUDEL_VIEWPORT
} from './config'
import type {
  StrudelRenderFile,
  StrudelRenderFunction,
  StrudelRenderRequest,
  StrudelRenderResult
} from './types'
import { readWavDurationSeconds } from './wav'

const resolveEditorUrl = (): string => {
  const configuredUrl =
    process.env[STRUDEL_EDITOR_URL_ENV] ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.URL ??
    'http://localhost:5317'
  return `${configuredUrl.replace(/\/$/, '')}${STRUDEL_EDITOR_ROUTE}`
}

const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'The render failed'
  return (error.message.split('\n')[0] ?? 'The render failed').slice(0, STRUDEL_ERROR_MESSAGE_MAX)
}

const launchBrowser = async (): Promise<Browser> => {
  const isServerless = process.env.CONTEXT !== undefined && process.env.CONTEXT !== 'dev'
  if (!isServerless) {
    const { chromium } = await import('playwright')
    return chromium.launch({
      headless: true,
      timeout: STRUDEL_BROWSER_LAUNCH_TIMEOUT_MS,
      args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']
    })
  }

  const [{ chromium }, { default: serverlessChromium }] = await Promise.all([
    import('playwright'),
    import('@sparticuz/chromium-min')
  ])
  const executablePath = await serverlessChromium.executablePath(STRUDEL_CHROMIUM_PACK_URL)
  return chromium.launch({
    executablePath,
    headless: true,
    timeout: STRUDEL_BROWSER_LAUNCH_TIMEOUT_MS,
    args: [...serverlessChromium.args, '--mute-audio', '--autoplay-policy=no-user-gesture-required']
  })
}

const createPage = async (browser: Browser, editorUrl: string): Promise<Page> => {
  const context = await browser.newContext({
    acceptDownloads: true,
    serviceWorkers: 'block',
    viewport: STRUDEL_VIEWPORT
  })
  const page = await context.newPage()
  page.setDefaultTimeout(STRUDEL_ACTION_TIMEOUT_MS)

  const editorOrigin = new URL(editorUrl).origin
  const sampleHosts = new Set<string>(STRUDEL_SAMPLE_HOSTS)
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
      await route.continue()
      return
    }
    const parsedUrl = new URL(requestUrl)
    const isEditorAsset =
      parsedUrl.origin === editorOrigin && !parsedUrl.pathname.startsWith('/api/')
    if (isEditorAsset || sampleHosts.has(parsedUrl.host)) {
      await route.continue()
      return
    }
    await route.abort()
  })

  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[strudel-render] ${message.text()}`)
  })
  page.on('pageerror', (error) => console.error(`[strudel-render] ${error.message}`))
  return page
}

const applyExportOptions = async (page: Page, request: StrudelRenderRequest): Promise<void> => {
  const exportPanel = page.locator('aside')
  const formatLabel = request.format === 'midi' ? 'MIDI' : 'WAV'
  await exportPanel.getByRole('button', { name: formatLabel, exact: true }).click()
  await exportPanel.getByLabel('Name', { exact: true }).fill(STRUDEL_RENDER_NAME)
  await exportPanel.getByLabel('Start cycle').fill(String(request.startCycle))
  await exportPanel.getByLabel('Cycles').fill(String(request.cycles))

  if (request.format === 'wav') {
    const matchingSampleRate = STRUDEL_SAMPLE_RATES.find(
      (sampleRate) => sampleRate === request.sampleRate
    )
    const sampleRateLabel =
      matchingSampleRate === undefined ? undefined : STRUDEL_SAMPLE_RATE_LABELS[matchingSampleRate]
    if (sampleRateLabel === undefined) throw new Error('Unsupported sample rate')
    await exportPanel.getByRole('button', { name: sampleRateLabel, exact: true }).click()
  }
}

const waitForDownload = async (page: Page): Promise<Download> => {
  const exportPanel = page.locator('aside')
  const exportButton = exportPanel.getByRole('button', { name: /^Export to (WAV|MIDI)$/ })
  const alert = exportPanel.getByRole('alert').first()
  const failure = alert.waitFor({ timeout: STRUDEL_DOWNLOAD_TIMEOUT_MS }).then(async () => {
    throw new Error(await alert.innerText())
  })
  const [download] = await Promise.race([
    Promise.all([
      page.waitForEvent('download', { timeout: STRUDEL_DOWNLOAD_TIMEOUT_MS }),
      exportButton.click()
    ]),
    failure
  ])
  return download
}

const renderInPage = async (
  page: Page,
  request: StrudelRenderRequest,
  editorUrl: string
): Promise<Download> => {
  await page.addInitScript(
    ({ storageKey, patternCode }: { storageKey: string; patternCode: string }) => {
      window.localStorage.setItem(storageKey, patternCode)
    },
    { storageKey: STRUDEL_EDITOR_STORAGE_KEY, patternCode: request.code }
  )
  await page.goto(editorUrl, {
    waitUntil: 'domcontentloaded',
    timeout: STRUDEL_NAVIGATION_TIMEOUT_MS
  })
  await applyExportOptions(page, request)
  return waitForDownload(page)
}

const readDownload = async (
  download: Download,
  workDirectory: string,
  request: StrudelRenderRequest
): Promise<Uint8Array> => {
  const outputPath = join(
    workDirectory,
    `${STRUDEL_RENDER_NAME}.${STRUDEL_FILE_EXTENSIONS[request.format]}`
  )
  await download.saveAs(outputPath)
  return new Uint8Array(await readFile(outputPath))
}

const makeRenderFile = (bytes: Uint8Array, request: StrudelRenderRequest): StrudelRenderResult => {
  if (request.format === 'wav') {
    const durationSeconds = readWavDurationSeconds(bytes)
    if (durationSeconds === null) {
      return {
        ok: false,
        status: STRUDEL_HTTP_STATUS.unprocessableEntity,
        message: 'The renderer returned a file that is not a WAV'
      }
    }
    if (durationSeconds > STRUDEL_RENDER_SECONDS_MAX) {
      return {
        ok: false,
        status: STRUDEL_HTTP_STATUS.payloadTooLarge,
        message: `The render is ${durationSeconds.toFixed(1)} seconds long; the limit is ${STRUDEL_RENDER_SECONDS_MAX}`
      }
    }
  }

  const file: StrudelRenderFile = {
    bytes,
    contentType: STRUDEL_CONTENT_TYPES[request.format],
    fileName: `${STRUDEL_RENDER_NAME}.${STRUDEL_FILE_EXTENSIONS[request.format]}`
  }
  return { ok: true, file }
}

/**
 * Renders Strudel code through the deployed editor in a headless browser and returns the file.
 * @param request - the validated code, format, range and sample rate
 * @returns the rendered WAV or MIDI bytes, or the status and message to send back
 */
export const renderStrudelFile: StrudelRenderFunction = async (request) => {
  const editorUrl = resolveEditorUrl()
  const browser = await launchBrowser().catch((error: unknown) => {
    console.error(`[strudel-render] ${describeError(error)}`)
    return undefined
  })
  if (browser === undefined) {
    return {
      ok: false,
      status: STRUDEL_HTTP_STATUS.serviceUnavailable,
      message: 'The renderer could not start'
    }
  }

  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    void browser.close().catch(() => undefined)
  }, STRUDEL_RENDER_TIMEOUT_MS)

  try {
    const page = await createPage(browser, editorUrl)
    const download = await renderInPage(page, request, editorUrl)
    const workDirectory = await mkdtemp(join(tmpdir(), 'strudel-render-'))
    try {
      const bytes = await readDownload(download, workDirectory, request)
      return makeRenderFile(bytes, request)
    } finally {
      await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined)
    }
  } catch (error) {
    if (timedOut) {
      return {
        ok: false,
        status: STRUDEL_HTTP_STATUS.gatewayTimeout,
        message: `The render did not finish within ${STRUDEL_RENDER_TIMEOUT_MS / 1000} seconds`
      }
    }
    const message = describeError(error)
    console.error(`[strudel-render] ${message}`)
    return { ok: false, status: STRUDEL_HTTP_STATUS.unprocessableEntity, message }
  } finally {
    clearTimeout(timeout)
    await browser.close().catch(() => undefined)
  }
}
