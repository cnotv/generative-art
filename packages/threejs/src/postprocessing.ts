import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { PixelShader } from './shaders/PixelShader'
import { PostProcessingConfig } from './types'

type ShaderDefinition = ConstructorParameters<typeof ShaderPass>[0]
type UniformValue = number | number[] | THREE.Vector2 | THREE.Vector3 | THREE.Color | boolean

async function addShaderPass({
  composer,
  Shader,
  uniforms = {},
  uniformTransforms = {}
}: {
  composer: EffectComposer
  Shader: ShaderDefinition
  uniforms?: Record<string, UniformValue>
  uniformTransforms?: Record<string, (value: UniformValue) => UniformValue>
}) {
  const pass = new ShaderPass(Shader)
  Object.keys(uniforms).forEach((key) => {
    if (pass.uniforms[key] !== undefined) {
      pass.uniforms[key].value = uniformTransforms[key]
        ? uniformTransforms[key](uniforms[key])
        : uniforms[key]
    }
  })
  composer.addPass(pass)
}

const applyBloom = async (
  composer: EffectComposer,
  renderer: THREE.WebGLRenderer,
  config: PostProcessingConfig
) => {
  if (!config?.bloom) return
  const { strength = 0.6, threshold = 0.2, radius = 0.8 } = config.bloom
  const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
  composer.addPass(
    new UnrealBloomPass(renderer.getSize(new THREE.Vector2()), strength, radius, threshold)
  )
}

const applyFxaa = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.fxaa) return
  const { FXAAShader } = await import('three/examples/jsm/shaders/FXAAShader.js')
  await addShaderPass({
    composer,
    Shader: FXAAShader,
    uniforms: { resolution: [1 / window.innerWidth, 1 / window.innerHeight] }
  })
}

const applyDotScreen = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.dotScreen) return
  const { DotScreenShader } = await import('three/examples/jsm/shaders/DotScreenShader.js')
  const { scale = 1, angle = Math.PI / 4, center = [0.5, 0.5] } = config.dotScreen
  await addShaderPass({ composer, Shader: DotScreenShader, uniforms: { scale, angle, center } })
}

const applyRgbShift = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.rgbShift) return
  const { RGBShiftShader } = await import('three/examples/jsm/shaders/RGBShiftShader.js')
  await addShaderPass({
    composer,
    Shader: RGBShiftShader,
    uniforms: { amount: config.rgbShift.amount || 0.0015 }
  })
}

const applyFilm = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.film) return
  const { FilmPass } = await import('three/examples/jsm/postprocessing/FilmPass.js')
  const { noiseIntensity = 0.35, grayscale = false } = config.film
  composer.addPass(new FilmPass(noiseIntensity, grayscale))
}

const applySimplePasses = async (
  composer: EffectComposer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  config: PostProcessingConfig
) => {
  if (config?.glitch) {
    const { GlitchPass } = await import('three/examples/jsm/postprocessing/GlitchPass.js')
    composer.addPass(new GlitchPass())
  }
  if (config?.afterimage) {
    const { AfterimagePass } = await import('three/examples/jsm/postprocessing/AfterimagePass.js')
    composer.addPass(new AfterimagePass())
  }
  if (config?.ssao) {
    const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js')
    composer.addPass(new SSAOPass(scene, camera, window.innerWidth, window.innerHeight))
  }
}

const vignetteColorTransform = (color: UniformValue): UniformValue => {
  if (typeof color === 'number') {
    return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255]
  }
  if (Array.isArray(color)) return color
  return [0, 0, 0]
}

const applyVignette = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.vignette) return
  const { VignetteShader } = await import('./shaders/VignetteShader.js')
  await addShaderPass({
    composer,
    Shader: VignetteShader,
    uniforms: {
      offset: config.vignette.offset ?? 1.1,
      darkness: config.vignette.darkness ?? 1.2,
      ...(config.vignette.color !== undefined ? { vignetteColor: config.vignette.color } : {})
    },
    uniformTransforms: { vignetteColor: vignetteColorTransform }
  })
}

const applyColorCorrection = async (composer: EffectComposer, config: PostProcessingConfig) => {
  if (!config?.colorCorrection) return
  const { ColorCorrectionShader } = await import('./shaders/ColorCorrectionShader.js')
  await addShaderPass({
    composer,
    Shader: ColorCorrectionShader,
    uniforms: {
      powRGB: new THREE.Vector3(
        config.colorCorrection.contrast || 1.15,
        config.colorCorrection.saturation || 1.1,
        config.colorCorrection.brightness || 0.98
      )
    }
  })
}

/**
 * Abstracted postprocessing setup function
 * @param renderer
 * @param scene
 * @param camera
 * @param config
 * @returns EffectComposer|null
 */
const setupPostprocessing = async ({
  renderer,
  scene,
  camera,
  config
}: {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  config: PostProcessingConfig
}) => {
  const hasEffects =
    config && Object.keys(config).some((key) => !!(config as Record<string, unknown>)[key])
  if (!hasEffects) return null

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  if (config?.pixelate)
    await addShaderPass({
      composer,
      Shader: PixelShader,
      uniforms: { size: config.pixelate.size || 6.0 }
    })
  await applyBloom(composer, renderer, config)
  await applyFxaa(composer, config)
  await applyDotScreen(composer, config)
  await applyRgbShift(composer, config)
  await applyFilm(composer, config)
  await applySimplePasses(composer, scene, camera, config)
  await applyVignette(composer, config)
  await applyColorCorrection(composer, config)

  return composer
}

export { setupPostprocessing, addShaderPass, EffectComposer, RenderPass, ShaderPass }
