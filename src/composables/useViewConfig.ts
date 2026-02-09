import { ref, shallowReactive, computed, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { debounce } from '@/utils/lodash';

export type ControlSchema = {
  min?: number;
  max?: number;
  step?: number;
  boolean?: boolean;
  color?: boolean;
  label?: string;
  options?: string[];
};

export type ConfigControlsSchema = {
  [key: string]: ControlSchema | ConfigControlsSchema;
};

type OnChangeCallback = () => void;

type ConfigEntry = {
  config: Ref<Record<string, any>>;
  schema: ConfigControlsSchema;
  onChange?: OnChangeCallback;
  stopWatch?: () => void;
};

// Use shallowReactive to prevent Vue from unwrapping nested refs
const registry = shallowReactive<Record<string, ConfigEntry>>({});

// Default debounce delay in milliseconds
const DEFAULT_DEBOUNCE_DELAY = 500;

// Version counter to force reactivity updates
const version = ref(0);

/**
 * Register a view's config and schema for the controls panel
 * @param routeName - The route name to register the config for
 * @param config - The reactive config ref
 * @param schema - The schema for the controls panel
 * @param onChange - Optional callback that fires when config changes (auto-debounced)
 * @param debounceDelay - Custom debounce delay in ms (default: 150)
 */
export const registerViewConfig = (
  routeName: string,
  config: Ref<Record<string, any>>,
  schema: ConfigControlsSchema,
  onChange?: OnChangeCallback,
  debounceDelay: number = DEFAULT_DEBOUNCE_DELAY
) => {
  // Clean up any existing watcher
  const existingEntry = registry[routeName];
  if (existingEntry?.stopWatch) {
    existingEntry.stopWatch();
  }

  let stopWatch: (() => void) | undefined;

  // Set up debounced watcher if onChange callback provided
  if (onChange) {
    const debouncedCallback = debounce(onChange, debounceDelay);
    stopWatch = watch(
      () => JSON.stringify(config.value),
      () => {
        debouncedCallback();
      }
    );
  }

  // eslint-disable-next-line functional/immutable-data
  registry[routeName] = { config, schema, onChange, stopWatch };
  version.value++;
};

/**
 * Unregister a view's config when component unmounts
 */
export const unregisterViewConfig = (routeName: string) => {
  const entry = registry[routeName];
  // Clean up watcher if it exists
  if (entry?.stopWatch) {
    entry.stopWatch();
  }
  // eslint-disable-next-line functional/immutable-data
  delete registry[routeName];
  version.value++;
};

/**
 * Get the current view's config and schema
 */
export const useViewConfig = () => {
  const route = useRoute();

  const currentConfig = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.config.value ?? null;
  });

  const currentSchema = computed(() => {
    // Access version to create dependency
    void version.value;
    const routeName = route.name as string;
    const entry = registry[routeName];
    return entry?.schema ?? null;
  });

  const hasConfig = computed(() => currentSchema.value !== null);

  const updateConfig = (path: string, value: any) => {
    const routeName = route.name as string;
    const entry = registry[routeName];
    if (!entry) return;

    const keys = path.split('.');
    let object = entry.config.value;

    keys.slice(0, -1).forEach(key => {
      // eslint-disable-next-line functional/immutable-data
      if (object[key] === undefined) object[key] = {};
      object = object[key];
    });

    const lastKey = keys[keys.length - 1];
    // eslint-disable-next-line functional/immutable-data
    object[lastKey] = value;
  };

  const getConfigValue = (path: string): any => {
    if (!currentConfig.value) return undefined;

    const keys = path.split('.');
    let object = currentConfig.value;

    for (const key of keys) {
      if (object === undefined || object === null) return undefined;
      object = object[key];
    }

    return object;
  };

  return {
    currentConfig,
    currentSchema,
    hasConfig,
    updateConfig,
    getConfigValue
  };
};

/**
 * Helper to create a reactive config from a static config object
 */
export const createReactiveConfig = <T extends Record<string, any>>(config: T): Ref<T> => {
  return ref(JSON.parse(JSON.stringify(config))) as Ref<T>;
};

// Export for testing
export const _getRegistry = () => registry;
export const _clearRegistry = () => {
  // eslint-disable-next-line functional/immutable-data
  Object.keys(registry).forEach(key => delete registry[key]);
  version.value++;
};
