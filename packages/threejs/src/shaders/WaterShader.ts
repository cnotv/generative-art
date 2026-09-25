import * as THREE from 'three'

/**
 * Three's own `ReflectorShader` with two additions a water surface needs.
 *
 * It is fog-aware: the stock shader writes the reflected image straight out, so a reflection
 * stays sharp at a distance where the geometry it mirrors has already faded into the haze,
 * and the surface reads as a hole cut through the fog. `fog_fragment` puts it back on the
 * same curve as everything else.
 *
 * And it ripples: the reflection is sampled through a travelling sine displacement, so the
 * surface moves without a normal map to ship or a second texture fetch to pay for. A ripple
 * strength of zero leaves the stock mirror exactly.
 */
export const WaterShader = {
  name: 'WaterShader',

  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      time: { value: 0 },
      rippleStrength: { value: 0 },
      rippleScale: { value: 0 },
      rippleSpeed: { value: 0 }
    }
  ]),

  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vSurfaceUv;

    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vSurfaceUv = uv;

      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mvPosition;

      #include <fog_vertex>
      #include <logdepthbuf_vertex>
    }`,

  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float rippleStrength;
    uniform float rippleScale;
    uniform float rippleSpeed;
    varying vec4 vUv;
    varying vec2 vSurfaceUv;

    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    float blendOverlay( float base, float blend ) {
      return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
    }

    vec3 blendOverlay( vec3 base, vec3 blend ) {
      return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
    }

    void main() {
      #include <logdepthbuf_fragment>

      // Two crossing waves at different rates, so the surface never repeats visibly the way
      // a single travelling sine does.
      vec2 ripple = vec2(
        sin( vSurfaceUv.y * rippleScale + time * rippleSpeed ),
        cos( vSurfaceUv.x * rippleScale * 0.7 - time * rippleSpeed * 0.8 )
      ) * rippleStrength;

      vec4 base = texture2DProj( tDiffuse, vUv + vec4( ripple, 0.0, 0.0 ) );
      gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`
}
