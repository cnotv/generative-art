
import type { RouteLocationNormalizedLoaded } from "vue-router";
import * as dat from "dat.gui";

const create = <T extends Record<string, any>>(
  config: T,
  route: RouteLocationNormalizedLoaded,
  params: Record<string, any>,
  callback = () => {}
) => {
  const hasControl = route.query.control === 'true';
  if (hasControl) {
    const gui = new dat.GUI();
    const control = gui.addFolder("control");
    control.open();
    
    Object.keys(params).forEach(key => {
      if (params[key].addColor) {
        control.addColor(config, key);
      } else {
        const custom = control.add(config, key);
        custom.onChange(callback);
        Object.keys(params[key]).forEach((param) => {
          if (params[key][param] !== undefined && custom[param]) {
            custom[param](params[key][param])
          }
        });
      }
    });
  }
};

export const controls = {
  create,
};