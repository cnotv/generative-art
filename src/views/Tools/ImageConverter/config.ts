export type ImageFormat = 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif'

export type ConvertRequest = {
  id: string
  buffer: ArrayBuffer
  mimeType: string
  format: ImageFormat
  quality: number
  maxWidth: number
  maxHeight: number
  scalePct: number
}

export type ConvertResult = {
  id: string
  buffer: ArrayBuffer
  format: ImageFormat
  originalSize: number
  convertedSize: number
}

export type ConvertError = {
  id: string
  error: string
}

export type FormatOption = {
  value: ImageFormat
  label: string
  lossy: boolean
  extension: string
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'image/webp', label: 'WebP', lossy: true, extension: 'webp' },
  { value: 'image/jpeg', label: 'JPEG', lossy: true, extension: 'jpg' },
  { value: 'image/avif', label: 'AVIF', lossy: true, extension: 'avif' },
  { value: 'image/png', label: 'PNG', lossy: false, extension: 'png' }
]

export const DEFAULT_FORMAT: ImageFormat = 'image/webp'
export const DEFAULT_QUALITY = 85
export const DEFAULT_MAX_DIMENSION = 0
export const DEFAULT_SCALE_PCT = 100
export const ACCEPTED_TYPES = 'image/*'
