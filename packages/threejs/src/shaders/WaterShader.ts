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

      // Three layers of crossing waves, each finer, faster and quieter than the last. One
      // travelling sine reads as a rippled pane of glass, because every crest is the same size
      // and they all move together; water has a swell with chop riding on it.
      vec2 wave = vec2( 0.0 );
      float waveScale = rippleScale;
      float waveSpeed = rippleSpeed;
      float waveWeight = 1.0;
      for ( int layer = 0; layer < 3; layer ++ ) {
        wave += waveWeight * vec2(
          sin( vSurfaceUv.y * waveScale + vSurfaceUv.x * waveScale * 0.35 + time * waveSpeed ),
          cos( vSurfaceUv.x * waveScale * 0.7 - vSurfaceUv.y * waveScale * 0.2 - time * waveSpeed * 0.8 )
        );
        waveScale *= 2.3;
        waveSpeed *= 1.7;
        waveWeight *= 0.45;
      }
      vec2 ripple = wave * rippleStrength;

      // Scaled by vUv.w, which the projective divide takes straight back out again. Without it
      // the same displacement is spread over the whole near foreground and squeezed into a few
      // pixels at the horizon, and near the camera it pushes the sample clean off the
      // reflection and leaves a torn dark edge there.
      vec4 base = texture2DProj( tDiffuse, vUv + vec4( ripple * vUv.w, 0.0, 0.0 ) );
      gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`
}
