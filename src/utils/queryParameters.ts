import { useRoute, useRouter } from 'vue-router';
import type { ConfigControlsSchema, ControlSchema } from '@/stores/viewConfig';

/**
 * Traverses a ConfigControlsSchema and returns a map of
 * { dotted.config.path → queryParamName } for all fields with `queryParam` set.
 */
export const collectQueryParameterPaths = (
  schema: ConfigControlsSchema,
  prefix = ''
): Map<string, string> => {
  const result = new Map<string, string>();
  Object.entries(schema).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const control = value as ControlSchema;
    if (control.queryParam) {
      result.set(path, control.queryParam);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !control.min &&
      !control.max &&
      !control.options
    ) {
      collectQueryParameterPaths(value as ConfigControlsSchema, path).forEach(
        (parameterName, configPath) => result.set(configPath, parameterName)
      );
    }
  });
  return result;
};

/**
 * Composable that provides helpers for syncing a config object
 * with URL query parameters, driven by a ConfigControlsSchema.
 */
export const useQueryParameters = (schema: ConfigControlsSchema) => {
  const route = useRoute();
  const router = useRouter();
  const queryParameterPaths = collectQueryParameterPaths(schema);

  const readQueryParameters = (
    defaults: Record<string, unknown>
  ): Record<string, unknown> => {
    const config = JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;
    queryParameterPaths.forEach((parameterName, configPath) => {
      const queryValue = route.query[parameterName];
      if (queryValue === undefined || queryValue === null) return;
      const stringValue = String(queryValue);
      const keys = configPath.split('.');
      let target = config;
      keys.slice(0, -1).forEach((key) => {
        if (target[key] === undefined) target[key] = {};
        target = target[key] as Record<string, unknown>;
      });
      const parsed = Number(stringValue);
      target[keys[keys.length - 1]] = isNaN(parsed) ? stringValue : parsed;
    });
    return config;
  };

  const syncQueryParameters = (config: Record<string, unknown>) => {
    const updatedParameters: Record<string, string> = {};
    queryParameterPaths.forEach((parameterName, configPath) => {
      const value = configPath
        .split('.')
        .reduce<unknown>(
          (object, key) => (object as Record<string, unknown>)?.[key],
          config
        );
      if (value !== undefined && value !== null) {
        updatedParameters[parameterName] = String(value);
      }
    });
    router.replace({ query: { ...route.query, ...updatedParameters } });
  };

  return { readQueryParameters, syncQueryParameters };
};
