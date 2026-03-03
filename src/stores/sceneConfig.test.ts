import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSceneConfigStore, globalSceneSchema, type SceneConfigRegistration } from './sceneConfig';

describe('useSceneConfigStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('defaults', () => {
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
    ])('getValue(%s) returns %s by default', (path, expected) => {
      const store = useSceneConfigStore();
      expect(store.getValue(path)).toBe(expected);
    });

    it('uses globalSceneSchema by default', () => {
      const store = useSceneConfigStore();
      expect(store.schema).toStrictEqual(globalSceneSchema);
    });
  });

  describe('updateValue', () => {
    it.each([
      ['global.frameRate', 30],
      ['orbit.disabled', true],
      ['postprocessing.bloom.strength', 3.0],
      ['postprocessing.vignette.offset', 0.8],
    ])('persists update for %s', (path, value) => {
      const store = useSceneConfigStore();
      store.updateValue(path, value);
      expect(store.getValue(path)).toBe(value);
    });
  });

  describe('registerSceneConfig', () => {
    it('overrides schema and uses external getValue/updateValue', () => {
      const store = useSceneConfigStore();
      const mockGetValue = vi.fn().mockReturnValue(42);
      const mockUpdateValue = vi.fn();
      const customSchema = { custom: { value: { min: 0, max: 100 } } };
      const registration: SceneConfigRegistration = {
        schema: customSchema,
        getValue: mockGetValue,
        updateValue: mockUpdateValue,
      };

      store.registerSceneConfig(registration);

      expect(store.schema).toEqual(customSchema);
      expect(store.getValue('custom.value')).toBe(42);
      expect(mockGetValue).toHaveBeenCalledWith('custom.value');

      store.updateValue('custom.value', 99);
      expect(mockUpdateValue).toHaveBeenCalledWith('custom.value', 99);
    });
  });

  describe('unregisterSceneConfig', () => {
    it('reverts schema and getValue/updateValue to defaults after unregister', () => {
      const store = useSceneConfigStore();
      const mockGetValue = vi.fn().mockReturnValue(999);
      store.registerSceneConfig({
        schema: { custom: {} },
        getValue: mockGetValue,
        updateValue: vi.fn(),
      });

      store.unregisterSceneConfig();

      expect(store.schema).toStrictEqual(globalSceneSchema);
      expect(store.getValue('global.frameRate')).toBe(60);
      expect(mockGetValue).not.toHaveBeenCalled();
    });

    it('resets internal config to GLOBAL_SCENE_DEFAULTS after unregister', () => {
      const store = useSceneConfigStore();
      store.updateValue('global.frameRate', 30);
      expect(store.getValue('global.frameRate')).toBe(30);

      store.unregisterSceneConfig();
      expect(store.getValue('global.frameRate')).toBe(60);
    });
  });

  describe('mock compatibility', () => {
    it('works with mock data without Three.js', () => {
      const store = useSceneConfigStore();
      expect(store.getValue('global.frameRate')).toBe(60);
      store.updateValue('postprocessing.bloom.enabled', true);
      expect(store.getValue('postprocessing.bloom.enabled')).toBe(true);
    });
  });
});
