import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { SCENE_DEFAULTS } from '@webgamekit/threejs';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { cameraSchema, groundSchema, lightsSchema, skySchema } from './config';

// Standard scene elements that must always show properties when selected.
// This test acts as a contract: if any schema becomes empty or a standard
// element is left unregistered, the test fails — making an empty Properties
// panel impossible for these elements.
const STANDARD_ELEMENT_SCHEMAS = {
  camera: cameraSchema,
  ground: groundSchema,
  lights: lightsSchema,
  sky: skySchema,
} as const;

type StandardElementKey = keyof typeof STANDARD_ELEMENT_SCHEMAS;

describe('SceneEditor element schemas — Properties panel contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  describe('all standard element schemas are non-empty', () => {
    it.each(Object.entries(STANDARD_ELEMENT_SCHEMAS) as [StandardElementKey, Record<string, unknown>][])(
      '"%s" schema has at least one property',
      (_name, schema) => {
        expect(Object.keys(schema).length).toBeGreaterThan(0);
      }
    );
  });

  describe('each schema contains the expected top-level keys', () => {
    it.each([
      ['camera', ['position', 'fov', 'orbitTarget']],
      ['ground', ['color', 'size']],
      ['lights', ['ambient', 'directional']],
      ['sky', ['color', 'size']],
    ] as [StandardElementKey, string[]][])(
      '"%s" schema contains required properties',
      (name, expectedKeys) => {
        const schema = STANDARD_ELEMENT_SCHEMAS[name];
        expectedKeys.forEach(key => {
          expect(Object.keys(schema)).toContain(key);
        });
      }
    );
  });

  describe('ground schema controls cover SCENE_DEFAULTS fields', () => {
    it('has a color control', () => {
      expect((groundSchema.color as Record<string, unknown>).color).toBe(true);
    });

    it('has a size CoordinateInput', () => {
      expect((groundSchema.size as Record<string, unknown>).component).toBe('CoordinateInput');
    });

    it('SCENE_DEFAULTS.ground.color is a valid hex number', () => {
      expect(typeof SCENE_DEFAULTS.ground.color).toBe('number');
    });

    it('SCENE_DEFAULTS.ground.size has three components', () => {
      expect(SCENE_DEFAULTS.ground.size).toHaveLength(3);
    });
  });

  describe('lights schema controls cover SCENE_DEFAULTS fields', () => {
    it('ambient section has color and intensity controls', () => {
      const ambient = lightsSchema.ambient as Record<string, unknown>;
      expect((ambient.color as Record<string, unknown>).color).toBe(true);
      expect((ambient.intensity as Record<string, unknown>).min).toBeDefined();
      expect((ambient.intensity as Record<string, unknown>).max).toBeDefined();
    });

    it('directional section has color, intensity and position controls', () => {
      const directional = lightsSchema.directional as Record<string, unknown>;
      expect((directional.color as Record<string, unknown>).color).toBe(true);
      expect((directional.intensity as Record<string, unknown>).min).toBeDefined();
      expect((directional.position as Record<string, unknown>).component).toBe('CoordinateInput');
    });

    it.each([
      ['ambient.color', SCENE_DEFAULTS.lights.ambient.color],
      ['ambient.intensity', SCENE_DEFAULTS.lights.ambient.intensity],
      ['directional.color', SCENE_DEFAULTS.lights.directional.color],
      ['directional.intensity', SCENE_DEFAULTS.lights.directional.intensity],
    ])('SCENE_DEFAULTS.lights.%s has a valid default value', (_path, value) => {
      expect(value).toBeDefined();
      expect(typeof value).toBe('number');
    });
  });

  describe('sky schema controls cover SCENE_DEFAULTS fields', () => {
    it('has a color control', () => {
      expect((skySchema.color as Record<string, unknown>).color).toBe(true);
    });

    it('has a size slider control', () => {
      const size = skySchema.size as Record<string, unknown>;
      expect(size.min).toBeDefined();
      expect(size.max).toBeDefined();
    });

    it('SCENE_DEFAULTS.sky values are valid', () => {
      expect(typeof SCENE_DEFAULTS.sky.color).toBe('number');
      expect(typeof SCENE_DEFAULTS.sky.size).toBe('number');
      expect(SCENE_DEFAULTS.sky.size).toBeGreaterThan(0);
    });
  });

  describe('camera schema controls cover expected fields', () => {
    it('position is a CoordinateInput', () => {
      expect((cameraSchema.position as Record<string, unknown>).component).toBe('CoordinateInput');
    });

    it('fov has min/max range', () => {
      const fov = cameraSchema.fov as Record<string, unknown>;
      expect(fov.min).toBe(10);
      expect(fov.max).toBe(170);
    });

    it('orbitTarget is a CoordinateInput', () => {
      expect((cameraSchema.orbitTarget as Record<string, unknown>).component).toBe('CoordinateInput');
    });
  });

  describe('Properties panel never shows empty content for standard elements', () => {
    // Simulate the SceneEditor registering each standard element and verify
    // that openElementProperties always yields a non-empty schema.
    it.each(Object.entries(STANDARD_ELEMENT_SCHEMAS) as [StandardElementKey, Record<string, unknown>][])(
      '"%s" element has non-empty activeProperties.schema when selected',
      (name, schema) => {
        // Arrange
        const store = useElementPropertiesStore();
        const { activeProperties } = storeToRefs(store);
        const { registerElementProperties, openElementProperties, clearAllElementProperties } = store;

        registerElementProperties(name, {
          title: name,
          schema,
          getValue: () => undefined,
          updateValue: () => {},
        });

        // Act
        openElementProperties(name);

        // Assert
        expect(activeProperties.value).not.toBeNull();
        expect(Object.keys(activeProperties.value!.schema).length).toBeGreaterThan(0);

        clearAllElementProperties();
      }
    );
  });
});
