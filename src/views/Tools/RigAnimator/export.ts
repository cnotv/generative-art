import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { PoseKeyframe } from '@webgamekit/rig'
import { downloadDataUrl } from '@/utils/downloadDataUrl'

type TextureSlot = { material: THREE.Material; key: string; texture: THREE.Texture }

/** Every texture on the model's materials, with the material property it is held in. */
const textureSlotsOf = (model: THREE.Object3D): TextureSlot[] =>
  model
    .getObjectsByProperty('isMesh', true)
    .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
    .flatMap((mesh) => [mesh.material].flat())
    .flatMap((material) =>
      Object.entries(material)
        .filter((entry): entry is [string, THREE.Texture] => entry[1] instanceof THREE.Texture)
        .map(([key, texture]) => ({ material, key, texture }))
    )

/** Whether the exporter can draw a texture's image: loaded, and with pixels to read. */
const isImageReadable = (image: unknown): boolean =>
  image instanceof HTMLImageElement
    ? image.complete && image.naturalWidth > 0
    : typeof image === 'object' && image !== null && 'width' in image && Number(image.width) > 0

const settleImage = (image: unknown): Promise<unknown> =>
  image instanceof HTMLImageElement && !image.complete
    ? image.decode().catch(() => undefined)
    : Promise.resolve()

/**
 * Bake a model, and any clips given with it, into a single downloadable .glb, playable in any
 * glTF viewer or engine outside this tool.
 *
 * The exporter refuses the whole model over a single texture it cannot read, and a model's
 * textures keep decoding for a few seconds after it appears, or never arrive at all when a file
 * points at an image it does not carry. So pending images are waited for, and any still unreadable
 * are left out of this one export and handed straight back to the model afterwards.
 * @param model The model to export, rigged or not
 * @param filename Name to save the file under
 * @param animations Clips to bundle with it, such as one built from authored pose keyframes
 * @returns Once the file has been handed to the browser to save
 */
export const exportModelAsGlb = async (
  model: THREE.Object3D,
  filename: string,
  animations: THREE.AnimationClip[] = []
): Promise<void> => {
  const slots = textureSlotsOf(model)
  await Promise.all(slots.map(({ texture }) => settleImage(texture.image)))
  const unreadable = slots.filter(({ texture }) => !isImageReadable(texture.image))
  unreadable.forEach(({ material, key }) => Object.assign(material, { [key]: null }))
  try {
    const result = await new GLTFExporter().parseAsync(model, { binary: true, animations })
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
    downloadDataUrl(URL.createObjectURL(blob), filename)
  } finally {
    unreadable.forEach(({ material, key, texture }) => Object.assign(material, { [key]: texture }))
  }
}

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
