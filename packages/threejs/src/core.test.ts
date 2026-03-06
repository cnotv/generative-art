import { describe, it, expect } from 'vitest';
import { SCENE_DEFAULTS } from './defaults';
import { resolveSetupConfig } from './core';

describe('resolveSetupConfig', () => {
  describe('lights', () => {
    it('uses SCENE_DEFAULTS when no lights config provided', () => {
      const result = resolveSetupConfig({});
      expect(result.lights).toEqual(SCENE_DEFAULTS.lights);
    });

    it('preserves false to disable lights', () => {
      const result = resolveSetupConfig({ lights: false });
      expect(result.lights).toBe(false);
    });

    it.each([
      ['ambient.color', { ambient: { color: 0xff0000 } }, 0xff0000],
      ['ambient.intensity', { ambient: { intensity: 5 } }, 5],
      ['directional.color', { directional: { color: 0x00ff00 } }, 0x00ff00],
      ['directional.intensity', { directional: { intensity: 8 } }, 8],
    ] as const)('overrides lights.%s while keeping other SCENE_DEFAULTS', (path, partial, expected) => {
      const result = resolveSetupConfig({ lights: partial });
      const [group, field] = path.split('.') as ['ambient' | 'directional', string];
      const lights = result.lights as Record<string, Record<string, unknown>>;
      expect(lights[group][field]).toBe(expected);
    });

    it('preserves SCENE_DEFAULTS for unspecified lights fields', () => {
      const result = resolveSetupConfig({ lights: { ambient: { color: 0xff0000 } } });
      const lights = result.lights as { ambient: { color: number; intensity: number } };
      expect(lights.ambient.intensity).toBe(SCENE_DEFAULTS.lights.ambient.intensity);
    });

    it('preserves SCENE_DEFAULTS directional when only ambient is overridden', () => {
      const result = resolveSetupConfig({ lights: { ambient: { intensity: 10 } } });
      const lights = result.lights as { directional: { color: number; intensity: number } };
      expect(lights.directional.color).toBe(SCENE_DEFAULTS.lights.directional.color);
      expect(lights.directional.intensity).toBe(SCENE_DEFAULTS.lights.directional.intensity);
    });
  });

  describe('ground', () => {
    it('uses SCENE_DEFAULTS when no ground config provided', () => {
      const result = resolveSetupConfig({});
      expect(result.ground).toEqual(SCENE_DEFAULTS.ground);
    });

    it('preserves false to disable ground', () => {
      const result = resolveSetupConfig({ ground: false });
      expect(result.ground).toBe(false);
    });

    it.each([
      ['color', { color: 0xffffff }],
      ['size', { size: [500, 0.1, 500] as [number, number, number] }],
    ] as const)('overrides ground.%s while keeping other SCENE_DEFAULTS', (field, partial) => {
      const result = resolveSetupConfig({ ground: partial });
      const ground = result.ground as Record<string, unknown>;
      const expected = (partial as unknown as Record<string, unknown>)[field];
      expect(ground[field]).toEqual(expected);
    });

    it('preserves SCENE_DEFAULTS.ground.color when only size is overridden', () => {
      const result = resolveSetupConfig({ ground: { size: [100, 0.01, 100] } });
      const ground = result.ground as { color: number };
      expect(ground.color).toBe(SCENE_DEFAULTS.ground.color);
    });
  });

  describe('sky', () => {
    it('uses SCENE_DEFAULTS when no sky config provided', () => {
      const result = resolveSetupConfig({});
      expect(result.sky).toEqual(SCENE_DEFAULTS.sky);
    });

    it('preserves false to disable sky', () => {
      const result = resolveSetupConfig({ sky: false });
      expect(result.sky).toBe(false);
    });

    it.each([
      ['color', { color: 0x112233 }],
      ['size', { size: 500 }],
    ] as const)('overrides sky.%s while keeping other SCENE_DEFAULTS', (field, partial) => {
      const result = resolveSetupConfig({ sky: partial });
      const sky = result.sky as Record<string, unknown>;
      const expected = (partial as unknown as Record<string, unknown>)[field];
      expect(sky[field]).toEqual(expected);
    });

    it('preserves SCENE_DEFAULTS.sky.color when only size is overridden', () => {
      const result = resolveSetupConfig({ sky: { size: 500 } });
      const sky = result.sky as { color: number };
      expect(sky.color).toBe(SCENE_DEFAULTS.sky.color);
    });
  });

  describe('camera', () => {
    it('leaves camera undefined when not provided', () => {
      const result = resolveSetupConfig({});
      expect(result.camera).toBeUndefined();
    });

    it('merges provided camera over SCENE_DEFAULTS.camera', () => {
      const result = resolveSetupConfig({ camera: { position: [0, 10, 50] } });
      const camera = result.camera as Record<string, unknown>;
      expect(camera.position).toEqual([0, 10, 50]);
      expect(camera.fov).toBe(SCENE_DEFAULTS.camera.fov);
    });

    it.each([
      ['position', [10, 20, 30]],
      ['fov', 90],
    ] as const)('overrides camera.%s while keeping other SCENE_DEFAULTS', (field, value) => {
      const result = resolveSetupConfig({ camera: { [field]: value } });
      const camera = result.camera as Record<string, unknown>;
      expect(camera[field]).toEqual(value);
    });
  });

  describe('passthrough fields', () => {
    it('preserves orbit config as-is', () => {
      const result = resolveSetupConfig({ orbit: false });
      expect(result.orbit).toBe(false);
    });

    it('preserves global config as-is', () => {
      const result = resolveSetupConfig({ global: { frameRate: 30 } });
      expect(result.global?.frameRate).toBe(30);
    });
  });
});
