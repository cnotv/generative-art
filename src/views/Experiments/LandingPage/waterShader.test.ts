import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWaterMaterial } from './waterShader';

describe('createWaterMaterial', () => {
  it('returns a ShaderMaterial', () => {
    const { material } = createWaterMaterial();
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
  });

  it('has a uTime uniform initialised to 0', () => {
    const { material } = createWaterMaterial();
    expect(material.uniforms.uTime).toBeDefined();
    expect(material.uniforms.uTime.value).toBe(0);
  });

  it('update() sets uTime on the material', () => {
    const { material, update } = createWaterMaterial();
    update(2.5);
    expect(material.uniforms.uTime.value).toBe(2.5);
  });

  it('update() overwrites previous time value', () => {
    const { material, update } = createWaterMaterial();
    update(1);
    update(3.7);
    expect(material.uniforms.uTime.value).toBe(3.7);
  });
});
