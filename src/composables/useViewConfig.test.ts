import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import {
  registerViewConfig,
  unregisterViewConfig,
  useViewConfig,
  createReactiveConfig,
  _getRegistry,
  _clearRegistry,
  type ConfigControlsSchema
} from './useViewConfig';

// Mock vue-router
const mockRouteName = ref('Test View');
vi.mock('vue-router', () => ({
  useRoute: () => ({
    get name() {
      return mockRouteName.value;
    }
  })
}));

describe('useViewConfig', () => {
  beforeEach(async () => {
    _clearRegistry();
    mockRouteName.value = 'Test View';
    await nextTick();
  });

  describe('registerViewConfig', () => {
    it('should register a config with the given route name', async () => {
      const config = ref({ test: 'value' });
      const schema: ConfigControlsSchema = { test: {} };

      registerViewConfig('Test View', config, schema);
      await nextTick();

      const registry = _getRegistry();
      expect('Test View' in registry).toBe(true);

      const entry = registry['Test View'];
      expect(entry).toBeDefined();
      expect(entry?.schema).toEqual({ test: {} });
      expect(entry?.config.value).toEqual({ test: 'value' });
    });

    it('should overwrite existing registration for same route', async () => {
      const config1 = ref({ first: true });
      const config2 = ref({ second: true });
      const schema: ConfigControlsSchema = { value: {} };

      registerViewConfig('Test View', config1, schema);
      registerViewConfig('Test View', config2, schema);
      await nextTick();

      const registry = _getRegistry();
      const entry = registry['Test View'];
      expect(entry?.config.value).toEqual({ second: true });
    });
  });

  describe('unregisterViewConfig', () => {
    it('should remove config from registry', async () => {
      const config = ref({ test: 'value' });
      const schema: ConfigControlsSchema = { test: {} };

      registerViewConfig('Test View', config, schema);
      await nextTick();
      expect('Test View' in _getRegistry()).toBe(true);

      unregisterViewConfig('Test View');
      await nextTick();
      expect('Test View' in _getRegistry()).toBe(false);
    });

    it('should not throw when unregistering non-existent route', () => {
      expect(() => unregisterViewConfig('Non Existent')).not.toThrow();
    });
  });

  describe('useViewConfig composable', () => {
    it('should return null schema when no config registered for current route', async () => {
      const { currentSchema, hasConfig } = useViewConfig();
      await nextTick();

      expect(currentSchema.value).toBeNull();
      expect(hasConfig.value).toBe(false);
    });

    it('should return config and schema when registered for current route', async () => {
      const config = ref({
        camera: { fov: 80 },
        player: { speed: 2 }
      });
      const schema: ConfigControlsSchema = {
        camera: { fov: { min: 30, max: 120 } },
        player: { speed: { min: 1, max: 10 } }
      };

      const { currentConfig, currentSchema, hasConfig } = useViewConfig();

      registerViewConfig('Test View', config, schema);
      await nextTick();

      expect(hasConfig.value).toBe(true);
      expect(currentSchema.value).toEqual(schema);
      expect(currentConfig.value).toEqual(config.value);
    });

    it('should get nested config values via path', async () => {
      const config = ref({
        camera: {
          position: { x: 10, y: 20, z: 30 }
        }
      });
      const schema: ConfigControlsSchema = {
        camera: {
          position: {
            x: { min: -50, max: 50 },
            y: { min: 0, max: 100 },
            z: { min: 0, max: 100 }
          }
        }
      };

      const { getConfigValue } = useViewConfig();

      registerViewConfig('Test View', config, schema);
      await nextTick();

      expect(getConfigValue('camera.position.x')).toBe(10);
      expect(getConfigValue('camera.position.y')).toBe(20);
      expect(getConfigValue('camera.position.z')).toBe(30);
      expect(getConfigValue('camera')).toEqual({ position: { x: 10, y: 20, z: 30 } });
    });

    it('should return undefined for non-existent paths', async () => {
      const config = ref({ existing: 'value' });
      const schema: ConfigControlsSchema = { existing: {} };

      const { getConfigValue } = useViewConfig();

      registerViewConfig('Test View', config, schema);
      await nextTick();

      expect(getConfigValue('nonexistent')).toBeUndefined();
      expect(getConfigValue('existing.deep.path')).toBeUndefined();
    });

    it('should update nested config values', async () => {
      const config = ref({
        camera: { fov: 80 },
        player: { speed: { movement: 2, jump: 4 } }
      });
      const schema: ConfigControlsSchema = {
        camera: { fov: { min: 30, max: 120 } },
        player: { speed: { movement: {}, jump: {} } }
      };

      const { updateConfig, getConfigValue } = useViewConfig();

      registerViewConfig('Test View', config, schema);
      await nextTick();

      updateConfig('camera.fov', 100);
      await nextTick();
      expect(getConfigValue('camera.fov')).toBe(100);

      updateConfig('player.speed.movement', 5);
      await nextTick();
      expect(getConfigValue('player.speed.movement')).toBe(5);
    });
  });

  describe('scene config', () => {
    it('should register scene config and schema separately', async () => {
      const config = ref({ player: { speed: 2 } });
      const schema: ConfigControlsSchema = { player: { speed: { min: 1, max: 10 } } };
      const sceneConfig = ref({ camera: { fov: 80 } });
      const sceneSchema: ConfigControlsSchema = { camera: { fov: { min: 30, max: 120 } } };

      registerViewConfig('Test View', config, schema, sceneConfig, sceneSchema);
      await nextTick();

      const registry = _getRegistry();
      const entry = registry['Test View'];

      expect(entry?.sceneConfig?.value).toEqual({ camera: { fov: 80 } });
      expect(entry?.sceneSchema).toEqual({ camera: { fov: { min: 30, max: 120 } } });
    });

    it('should return scene config and schema via useViewConfig', async () => {
      const config = ref({ player: { speed: 2 } });
      const schema: ConfigControlsSchema = { player: { speed: {} } };
      const sceneConfig = ref({ camera: { fov: 80 } });
      const sceneSchema: ConfigControlsSchema = { camera: { fov: {} } };

      const { currentSceneConfig, currentSceneSchema, hasSceneConfig } = useViewConfig();

      registerViewConfig('Test View', config, schema, sceneConfig, sceneSchema);
      await nextTick();

      expect(hasSceneConfig.value).toBe(true);
      expect(currentSceneConfig.value).toEqual({ camera: { fov: 80 } });
      expect(currentSceneSchema.value).toEqual({ camera: { fov: {} } });
    });

    it('should get scene config values via path', async () => {
      const config = ref({ player: { speed: 2 } });
      const schema: ConfigControlsSchema = { player: {} };
      const sceneConfig = ref({
        camera: { position: { x: 10, y: 20, z: 30 } }
      });
      const sceneSchema: ConfigControlsSchema = {
        camera: { position: { x: {}, y: {}, z: {} } }
      };

      const { getSceneConfigValue } = useViewConfig();

      registerViewConfig('Test View', config, schema, sceneConfig, sceneSchema);
      await nextTick();

      expect(getSceneConfigValue('camera.position.x')).toBe(10);
      expect(getSceneConfigValue('camera.position.y')).toBe(20);
      expect(getSceneConfigValue('camera.position.z')).toBe(30);
    });

    it('should update scene config values', async () => {
      const config = ref({ player: { speed: 2 } });
      const schema: ConfigControlsSchema = { player: {} };
      const sceneConfig = ref({ camera: { fov: 80 } });
      const sceneSchema: ConfigControlsSchema = { camera: { fov: {} } };

      const { updateSceneConfig, getSceneConfigValue } = useViewConfig();

      registerViewConfig('Test View', config, schema, sceneConfig, sceneSchema);
      await nextTick();

      updateSceneConfig('camera.fov', 100);
      await nextTick();

      expect(getSceneConfigValue('camera.fov')).toBe(100);
    });
  });

  describe('createReactiveConfig', () => {
    it('should create a deep copy of the config', () => {
      const original = {
        nested: { value: 1 },
        array: [1, 2, 3]
      };

      const reactive = createReactiveConfig(original);

      // Modify original
      original.nested.value = 999;
      original.array.push(4);

      // Reactive should be unchanged
      expect(reactive.value.nested.value).toBe(1);
      expect(reactive.value.array).toEqual([1, 2, 3]);
    });

    it('should return a ref', () => {
      const reactive = createReactiveConfig({ test: 'value' });

      expect(reactive.value).toBeDefined();
      expect(reactive.value.test).toBe('value');
    });

    it('should create multiple independent reactive configs', () => {
      const config1 = createReactiveConfig({ value: 1 });
      const config2 = createReactiveConfig({ value: 2 });

      expect(config1.value.value).toBe(1);
      expect(config2.value.value).toBe(2);

      config1.value.value = 10;
      expect(config1.value.value).toBe(10);
      expect(config2.value.value).toBe(2); // Should not be affected
    });
  });
});
