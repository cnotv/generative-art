import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGlobalSceneValue,
  updateGlobalSceneConfig,
  _resetGlobalSceneConfig,
  globalSceneSchema,
} from './useGlobalSceneConfig';

describe('useGlobalSceneConfig', () => {
  beforeEach(() => {
    _resetGlobalSceneConfig();
  });

  describe('initial default values', () => {
    it.each([
      ['global.frameRate', 60],
      ['orbit.disabled', false],
      ['postprocessing.bloom.enabled', false],
      ['postprocessing.bloom.strength', 1.5],
      ['postprocessing.bloom.threshold', 0.5],
      ['postprocessing.bloom.radius', 0.5],
      ['postprocessing.vignette.enabled', false],
      ['postprocessing.vignette.offset', 0.5],
      ['postprocessing.vignette.darkness', 0.5],
    ])('getGlobalSceneValue("%s") returns default %s', (path, expected) => {
      expect(getGlobalSceneValue(path)).toBe(expected);
    });
  });

  describe('updateGlobalSceneConfig', () => {
    it.each([
      ['global.frameRate', 30],
      ['orbit.disabled', true],
      ['postprocessing.bloom.enabled', true],
      ['postprocessing.bloom.strength', 2.0],
      ['postprocessing.bloom.threshold', 0.8],
      ['postprocessing.bloom.radius', 0.3],
      ['postprocessing.vignette.enabled', true],
      ['postprocessing.vignette.offset', 0.7],
      ['postprocessing.vignette.darkness', 0.9],
    ])('updates "%s" to %s and reads back correctly', (path, value) => {
      updateGlobalSceneConfig(path, value);
      expect(getGlobalSceneValue(path)).toBe(value);
    });
  });

  describe('_resetGlobalSceneConfig', () => {
    it('restores default values after multiple updates', () => {
      updateGlobalSceneConfig('global.frameRate', 30);
      updateGlobalSceneConfig('orbit.disabled', true);
      updateGlobalSceneConfig('postprocessing.bloom.enabled', true);

      _resetGlobalSceneConfig();

      expect(getGlobalSceneValue('global.frameRate')).toBe(60);
      expect(getGlobalSceneValue('orbit.disabled')).toBe(false);
      expect(getGlobalSceneValue('postprocessing.bloom.enabled')).toBe(false);
    });
  });

  describe('globalSceneSchema', () => {
    it.each(['global', 'orbit', 'postprocessing'])(
      'has "%s" section defined',
      section => {
        expect(globalSceneSchema[section]).toBeDefined();
      }
    );

    it('has frameRate control in global section', () => {
      const global = globalSceneSchema.global as Record<string, unknown>;
      const frameRate = global.frameRate as Record<string, unknown>;
      expect(frameRate).toBeDefined();
      expect(frameRate.min).toBe(1);
      expect(frameRate.max).toBe(120);
    });

    it('has disabled toggle in orbit section', () => {
      const orbit = globalSceneSchema.orbit as Record<string, unknown>;
      const disabled = orbit.disabled as Record<string, unknown>;
      expect(disabled).toBeDefined();
      expect(disabled.boolean).toBeDefined();
    });
  });
});
