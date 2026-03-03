import { describe, it, expect, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import {
  useViewConfigStore,
  createReactiveConfig,
  type ConfigControlsSchema,
} from './viewConfig';

describe('useViewConfigStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('registerViewConfig', () => {
    it('registers a config with the given route name', async () => {
      const store = useViewConfigStore();
      const config = ref({ test: 'value' });
      const schema: ConfigControlsSchema = { test: {} };

      store.registerViewConfig('Test View', config, schema);
      await nextTick();

      expect('Test View' in store.registry).toBe(true);
      expect(store.registry['Test View']?.schema).toEqual({ test: {} });
      expect(store.registry['Test View']?.config.value).toEqual({ test: 'value' });
    });

    it('overwrites existing registration for same route', async () => {
      const store = useViewConfigStore();
      const config1 = ref({ first: true });
      const config2 = ref({ second: true });
      const schema: ConfigControlsSchema = { value: {} };

      store.registerViewConfig('Test View', config1, schema);
      store.registerViewConfig('Test View', config2, schema);
      await nextTick();

      expect(store.registry['Test View']?.config.value).toEqual({ second: true });
    });

    it('increments version on registration', () => {
      const store = useViewConfigStore();
      const initialVersion = store.version;

      store.registerViewConfig('Test View', ref({ x: 1 }), {});

      expect(store.version).toBe(initialVersion + 1);
    });
  });

  describe('unregisterViewConfig', () => {
    it('removes config from registry', async () => {
      const store = useViewConfigStore();
      store.registerViewConfig('Test View', ref({ test: 'value' }), { test: {} });
      await nextTick();

      store.unregisterViewConfig('Test View');
      await nextTick();

      expect('Test View' in store.registry).toBe(false);
    });

    it('does not throw when unregistering non-existent route', () => {
      const store = useViewConfigStore();
      expect(() => store.unregisterViewConfig('Non Existent')).not.toThrow();
    });

    it('increments version on unregister', () => {
      const store = useViewConfigStore();
      store.registerViewConfig('Test View', ref({}), {});
      const versionAfterRegister = store.version;

      store.unregisterViewConfig('Test View');

      expect(store.version).toBe(versionAfterRegister + 1);
    });
  });

  describe('getConfigValue', () => {
    it.each([
      ['camera.fov', 80],
      ['player.speed', 2],
      ['camera.position.x', 10],
    ])('returns %s correctly', (path, expected) => {
      const store = useViewConfigStore();
      const config = ref({
        camera: { fov: 80, position: { x: 10, y: 20, z: 30 } },
        player: { speed: 2 },
      });
      store.registerViewConfig('Test View', config, {});

      expect(store.getConfigValue('Test View', path)).toBe(expected);
    });

    it('returns undefined for non-existent paths', () => {
      const store = useViewConfigStore();
      store.registerViewConfig('Test View', ref({ existing: 'value' }), {});

      expect(store.getConfigValue('Test View', 'nonexistent')).toBeUndefined();
    });

    it('returns undefined when no config registered', () => {
      const store = useViewConfigStore();
      expect(store.getConfigValue('No Route', 'any.path')).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it.each([
      ['camera.fov', 100],
      ['player.speed.movement', 5],
    ])('persists update for %s', async (path, value) => {
      const store = useViewConfigStore();
      const config = ref({
        camera: { fov: 80 },
        player: { speed: { movement: 2, jump: 4 } },
      });
      store.registerViewConfig('Test View', config, {});

      store.updateConfig('Test View', path, value);
      await nextTick();

      expect(store.getConfigValue('Test View', path)).toBe(value);
    });

    it('does not throw when route not registered', () => {
      const store = useViewConfigStore();
      expect(() => store.updateConfig('No Route', 'any.path', 42)).not.toThrow();
    });
  });

  describe('updateViewSchema', () => {
    it('replaces schema for registered route', () => {
      const store = useViewConfigStore();
      store.registerViewConfig('Test View', ref({}), { old: {} });
      const newSchema: ConfigControlsSchema = { new: { min: 0, max: 10 } };

      store.updateViewSchema('Test View', newSchema);

      expect(store.registry['Test View']?.schema).toEqual(newSchema);
    });

    it('increments version', () => {
      const store = useViewConfigStore();
      store.registerViewConfig('Test View', ref({}), {});
      const version = store.version;

      store.updateViewSchema('Test View', { updated: {} });

      expect(store.version).toBe(version + 1);
    });
  });

  describe('resetState', () => {
    it('clears all registry entries and resets version', () => {
      const store = useViewConfigStore();
      store.registerViewConfig('View A', ref({}), {});
      store.registerViewConfig('View B', ref({}), {});

      store.resetState();

      expect(Object.keys(store.registry)).toHaveLength(0);
      expect(store.version).toBe(0);
    });
  });

  describe('createReactiveConfig', () => {
    it('creates a deep copy of the config', () => {
      const original = { nested: { value: 1 }, array: [1, 2, 3] };

      const reactive = createReactiveConfig(original);
      original.nested.value = 999;

      expect(reactive.value.nested.value).toBe(1);
    });

    it('returns a ref', () => {
      const reactive = createReactiveConfig({ test: 'value' });
      expect(reactive.value.test).toBe('value');
    });

    it('creates independent copies', () => {
      const config1 = createReactiveConfig({ value: 1 });
      const config2 = createReactiveConfig({ value: 2 });

      config1.value.value = 10;

      expect(config1.value.value).toBe(10);
      expect(config2.value.value).toBe(2);
    });
  });
});
