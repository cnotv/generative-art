import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { PoseKeyframe } from '@webgamekit/animation'
import { downloadDataUrl } from '@/utils/downloadDataUrl'

/**
 * Bake a model and its generated clip into a single downloadable .glb, playable in any
 * glTF viewer or engine outside this tool.
 * @param model The rigged model to export
 * @param clip The animation clip built from the authored pose keyframes
 * @param filename Name to save the file under
 */
export const exportRigClipAsGlb = (
  model: THREE.Object3D,
  clip: THREE.AnimationClip,
  filename: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      model,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        downloadDataUrl(URL.createObjectURL(blob), filename)
        resolve()
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      { binary: true, animations: [clip] }
    )
  })

/**
 * Download the raw pose keyframes as JSON, re-importable into this same tool for further
 * editing.
 * @param keyframes The authored pose keyframes
 * @param fps Frames per second the keyframes were captured at
 * @param filename Name to save the file under
 */
export const exportPosesAsJson = (
  keyframes: PoseKeyframe[],
  fps: number,
  filename: string
): void => {
  const blob = new Blob([JSON.stringify({ fps, keyframes }, null, 2)], {
    type: 'application/json'
  })
  downloadDataUrl(URL.createObjectURL(blob), filename)
}

/**
 * Parse a previously exported poses file, rejecting anything that does not match the expected
 * shape rather than trusting an arbitrary uploaded file.
 * @param text The file's raw JSON text
 * @returns The parsed fps and keyframes, or null when the file does not match the expected shape
 */
export const parsePosesJson = (text: string): { fps: number; keyframes: PoseKeyframe[] } | null => {
  const parsed: unknown = JSON.parse(text)
  const candidate = parsed as { fps?: unknown; keyframes?: unknown } | null
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.fps !== 'number' ||
    !Array.isArray(candidate.keyframes)
  ) {
    return null
  }
  return candidate as { fps: number; keyframes: PoseKeyframe[] }
}
