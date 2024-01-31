
import type { RouteLocationNormalizedLoaded } from "vue-router";
import * as dat from "dat.gui";

const create = <T extends Record<string, number>>(
  config: T,
  route: RouteLocationNormalizedLoaded,
  // params: Record<keyof Partial<T>, { min: number, max: number }>,
  params: Record<string, { min: number, max: number }>,
  callback = () => {}
) => {
  const hasControl = route.query.control === 'true';
  if (hasControl) {
    const gui = new dat.GUI();
    const control = gui.addFolder("control");
    control.open();
    Object.keys(params).forEach(key => {
      control.add(config, key).min(params[key].min).max(params[key].max).onChange(callback);
    });
  }
};

export const controls = {
  create,
};