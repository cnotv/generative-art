import { ref } from 'vue';
import type { ConfigControlsSchema } from './useViewConfig';

interface GlobalSceneConfig {
  global: {
    frameRate: number;
  };
  orbit: {
    disabled: boolean;
  };
  postprocessing: {
    bloom: {
      enabled: boolean;
      strength: number;
      threshold: number;
      radius: number;
    };
    vignette: {
      enabled: boolean;
      offset: number;
      darkness: number;
    };
  };
}

const DEFAULT_CONFIG: GlobalSceneConfig = {
  global: {
    frameRate: 60,
  },
  orbit: {
    disabled: false,
  },
  postprocessing: {
    bloom: {
      enabled: false,
      strength: 1.5,
      threshold: 0.5,
      radius: 0.5,
    },
    vignette: {
      enabled: false,
      offset: 0.5,
      darkness: 0.5,
    },
  },
};

// Module-level state — shared across all composable calls
const globalSceneConfig = ref<GlobalSceneConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));

export const globalSceneSchema: ConfigControlsSchema = {
  global: {
    frameRate: { min: 1, max: 120, step: 1, label: 'Frame Rate' },
  },
  orbit: {
    disabled: { boolean: false, label: 'Disable Orbit Controls' },
  },
  postprocessing: {
    bloom: {
      enabled: { boolean: false, label: 'Bloom' },
      strength: { min: 0, max: 5, step: 0.1, label: 'Strength' },
      threshold: { min: 0, max: 1, step: 0.01, label: 'Threshold' },
      radius: { min: 0, max: 1, step: 0.01, label: 'Radius' },
    },
    vignette: {
      enabled: { boolean: false, label: 'Vignette' },
      offset: { min: 0, max: 1, step: 0.01, label: 'Offset' },
      darkness: { min: 0, max: 1, step: 0.01, label: 'Darkness' },
    },
  },
};

export const getGlobalSceneValue = (path: string): unknown =>
  path.split('.').reduce<unknown>((object, key) => {
    if (object === undefined || object === null) return undefined;
    return (object as Record<string, unknown>)[key];
  }, globalSceneConfig.value);

export const updateGlobalSceneConfig = (path: string, value: unknown): void => {
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce<Record<string, unknown>>((object, key) => {
    if (object[key] === undefined) {
      // eslint-disable-next-line functional/immutable-data
      object[key] = {};
    }
    return object[key] as Record<string, unknown>;
  }, globalSceneConfig.value as unknown as Record<string, unknown>);

  const lastKey = keys[keys.length - 1];
  // eslint-disable-next-line functional/immutable-data
  parent[lastKey] = value;
};

export const _resetGlobalSceneConfig = (): void => {
  globalSceneConfig.value = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
};

export { globalSceneConfig };
