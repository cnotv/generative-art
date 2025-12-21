
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { PixelShader } from './shaders/PixelShader';
import { PostProcessingConfig } from './types';

async function addShaderPass({
  composer,
  Shader,
  uniforms = {},
  uniformTransforms = {},
}: {
  composer: EffectComposer,
  Shader: any,
  uniforms?: Record<string, any>,
  uniformTransforms?: Record<string, (value: any) => any>,
}) {
  const pass = new ShaderPass(Shader);
  for (const key in uniforms) {
    if (pass.uniforms[key] !== undefined) {
      pass.uniforms[key].value =
        uniformTransforms[key] ? uniformTransforms[key](uniforms[key]) : uniforms[key];
    }
  }
  composer.addPass(pass);
}

/**
 * Abstracted postprocessing setup function
 * @param renderer
 * @param scene
 * @param camera
 * @param config
 * @returns EffectComposer|null
 */
const setupPostprocessing = async ({ renderer, scene, camera, config }: { renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, config: PostProcessingConfig }) => {
  let composer: EffectComposer | null = null;
  let hasAny = false;
  // Create composer if any postprocessing effect is enabled
  if (config && Object.keys(config).some(key => !!(config as any)[key])) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    hasAny = true;
  }

  // Pixelate
  if (composer && config?.pixelate) {
    await addShaderPass({
      composer,
      Shader: PixelShader,
      uniforms: {
        size: config.pixelate.size || 6.0,
      },
    })
  }

  // Bloom
  if (composer && config?.bloom) {
    const { strength = 0.6, threshold = 0.2, radius = 0.8 } = config.bloom;
    const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
    const size = renderer.getSize(new THREE.Vector2());
    const bloomPass = new UnrealBloomPass(size, strength, radius, threshold);
    composer.addPass(bloomPass);
  }

  // FXAA
  if (composer && config?.fxaa) {
    const { FXAAShader } = await import('three/examples/jsm/shaders/FXAAShader.js');
    await addShaderPass({
      composer,
      Shader: FXAAShader,
      uniforms: {
        resolution: [1 / window.innerWidth, 1 / window.innerHeight],
      },
    });
  }

  // DotScreen
  if (composer && config?.dotScreen) {
    const { DotScreenShader } = await import('three/examples/jsm/shaders/DotScreenShader.js');
    const { scale = 1, angle = Math.PI / 4, center = [0.5, 0.5] } = config.dotScreen;
    await addShaderPass({
      composer,
      Shader: DotScreenShader,
      uniforms: { scale, angle, center},
    });
  }

  // RGB Shift
  if (composer && config?.rgbShift) {
    const { RGBShiftShader } = await import('three/examples/jsm/shaders/RGBShiftShader.js');
    await addShaderPass({
      composer,
      Shader: RGBShiftShader,
      uniforms: {
        amount: config.rgbShift.amount || 0.0015,
      },
    });
  }

  // Film
  if (composer && config?.film) {
    const { FilmPass } = await import('three/examples/jsm/postprocessing/FilmPass.js');
    const { noiseIntensity = 0.35, grayscale = false } = config.film;
    const filmPass = new FilmPass(noiseIntensity, grayscale);
    composer.addPass(filmPass);
  }

  // Glitch
  if (composer && config?.glitch) {
    const { GlitchPass } = await import('three/examples/jsm/postprocessing/GlitchPass.js');
    const glitchPass = new GlitchPass();
    composer.addPass(glitchPass);
  }

  // Afterimage
  if (composer && config?.afterimage) {
    const { AfterimagePass } = await import('three/examples/jsm/postprocessing/AfterimagePass.js');
    const afterimagePass = new AfterimagePass();
    composer.addPass(afterimagePass);
  }

  // SSAO
  if (composer && config?.ssao) {
    const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js');
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    composer.addPass(ssaoPass);
  }

  // UnrealBloom (already added above as bloom)

  // Vignette
  if (composer && config?.vignette) {
    const { VignetteShader } = await import('./shaders/VignetteShader.js');
    await addShaderPass({
      composer,
      Shader: VignetteShader,
      uniforms: {
        offset: config.vignette.offset || 1.1,
        darkness: config.vignette.darkness || 1.2,
        vignetteColor: config.vignette.color,
      },
      uniformTransforms: {
        vignetteColor: (color: any) => {
          if (typeof color === 'number') {
            return [
              ((color >> 16) & 255) / 255,
              ((color >> 8) & 255) / 255,
              (color & 255) / 255
            ];
          } else if (Array.isArray(color)) {
            return color;
          } else {
            return [0, 0, 0];
          }
        },
      },
    });
  }

  // Color Correction
  if (composer && config?.colorCorrection) {
    const { ColorCorrectionShader } = await import('./shaders/ColorCorrectionShader.js');
    await addShaderPass({
      composer,
      Shader: ColorCorrectionShader,
      uniforms: {
        powRGB: new THREE.Vector3(
          config.colorCorrection.contrast || 1.15,
          config.colorCorrection.saturation || 1.1,
          config.colorCorrection.brightness || 0.98
        ),
      },
    });
  }

  return hasAny ? composer : null;
};


export { setupPostprocessing, addShaderPass, EffectComposer, RenderPass, ShaderPass };
