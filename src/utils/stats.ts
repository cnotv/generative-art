import type { RouteLocationNormalizedLoaded } from "vue-router";
import Stats from "stats.js";

const panel = new Stats();

const init = (route: RouteLocationNormalizedLoaded, statsEl: HTMLElement) => {
  const hasStats = route.query.stats === 'true';
  if (hasStats) {
    // FPS stats
    panel.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    statsEl!.appendChild(panel.dom);
  }
};

const start = (route: RouteLocationNormalizedLoaded) => {
  const hasStats = route.query.stats === 'true';

  if (panel && hasStats) {
    panel.begin();
  }
};

const end = (route: RouteLocationNormalizedLoaded) => {
  const hasStats = route.query.stats === 'true';

  if (panel && hasStats) {
    panel.end();
  };
}

export const stats = {
  init,
  start,
  end
};