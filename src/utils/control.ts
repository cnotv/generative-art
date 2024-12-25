
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
    const panel = document.querySelector('.dg.main');
    if (panel) {
      panel.remove();
    };
    
    const gui = new dat.GUI({ name: 'asd' });
    addPanel(gui, config, params, callback);
  }
};

const addPanel = <T extends Record<string, any>>(
  gui: dat.GUI,
  config: T,
  params: Record<string, any>,
  callback = () => { },
  panelName: string = 'Controls'
) => {
  const control = gui.addFolder(panelName);
  control.open();
  
  Object.keys(params).forEach(key => {
    // Nested controls
    if (config[key] && typeof config[key] === 'object') {
      addPanel(gui, config[key], params[key], callback, key);
    } else if (params[key] && params[key].addColor) {
      control.addColor(config, key);
    } else {
      const custom = control.add(config[panelName] ?? config, key);
      custom.onChange(callback);
      Object.keys(params[key]).forEach((param) => {
        if (params[key][param] !== undefined && custom[param]) {
          custom[param](params[key][param])
        }
      });
    }
  });
};

export const controls = {
  create,
};
