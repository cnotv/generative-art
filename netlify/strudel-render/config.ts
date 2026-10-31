export const STRUDEL_RENDER_PATH = '/api/strudel/render'
export const STRUDEL_EDITOR_ROUTE = '/tools/StrudelEditor#export'
export const STRUDEL_EDITOR_URL_ENV = 'STRUDEL_EDITOR_URL'
export const STRUDEL_EDITOR_STORAGE_KEY = 'strudel-editor-code'
export const STRUDEL_RENDER_NAME = 'strudel-render'

export const STRUDEL_CODE_MAX_BYTES = 16_384
export const STRUDEL_REQUEST_OVERHEAD_BYTES = 1024
export const STRUDEL_CYCLES_MAX = 16
export const STRUDEL_START_CYCLE_MAX = 1000
export const STRUDEL_RENDER_SECONDS_MAX = 30
export const STRUDEL_SAMPLE_RATES = [44_100, 48_000] as const
export const STRUDEL_DEFAULT_SAMPLE_RATE = 48_000
export const STRUDEL_SAMPLE_RATE_LABELS = {
  44_100: '44.1 kHz',
  48_000: '48 kHz'
} as const
export const STRUDEL_CONTENT_TYPES = {
  wav: 'audio/wav',
  midi: 'audio/midi'
} as const
export const STRUDEL_FILE_EXTENSIONS = {
  wav: 'wav',
  midi: 'mid'
} as const
export const STRUDEL_VIEWPORT = { width: 1280, height: 720 } as const
export const STRUDEL_ERROR_MESSAGE_MAX = 500

export const STRUDEL_RENDER_RATE_LIMIT = {
  action: 'rate_limit',
  aggregateBy: 'ip',
  windowSize: 60,
  windowLimit: 3
} as const

export const STRUDEL_RENDER_TIMEOUT_MS = 30_000
export const STRUDEL_BROWSER_LAUNCH_TIMEOUT_MS = 25_000
export const STRUDEL_NAVIGATION_TIMEOUT_MS = 20_000
export const STRUDEL_ACTION_TIMEOUT_MS = 15_000
export const STRUDEL_DOWNLOAD_TIMEOUT_MS = 25_000

export const STRUDEL_SAMPLE_HOSTS = [
  'strudel.b-cdn.net',
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com'
] as const

export const STRUDEL_CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar'

export const STRUDEL_HTTP_STATUS = {
  ok: 200,
  noContent: 204,
  badRequest: 400,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  unprocessableEntity: 422,
  serviceUnavailable: 503,
  gatewayTimeout: 504
} as const

export const STRUDEL_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
} as const

export const STRUDEL_WAV_HEADER = {
  size: 44,
  waveLabel: 8,
  channelCount: 22,
  sampleRate: 24,
  dataLabel: 36,
  dataSize: 40,
  bitsPerSample: 16,
  bitsPerByte: 8
} as const
