import { describe, it, expect } from 'vitest';
import { getRoutes } from '../config/router';

describe('getRoutes', () => {
  const makeViews = (keys: string[]) => {
    // Simulate import.meta.glob result
    const views: Record<string, () => Promise<unknown>> = {};
    keys.forEach(key => {
      views[key] = () => Promise.resolve({});
    });
    return views;
  };

  it('includes single-segment routes', () => {
    const views = makeViews([
      '/src/views/Games/GoombaRunner.vue',
      '/src/views/Games/ChickRun.vue',
    ]);
    const routes = getRoutes(views, 'Games');
    expect(routes.map(r => r.path)).toContain('/games/GoombaRunner');
    expect(routes.map(r => r.path)).toContain('/games/ChickRun');
  });

  it('skips multi-segment routes unless repeated', () => {
    const views = makeViews([
      '/src/views/Games/GoombaRunner/Somethingelse.vue',
      '/src/views/Games/GoombaRunner/GoombaRunner.vue',
      '/src/views/Games/ChickRun/ChickRun.vue',
      '/src/views/Games/ChickRun/Other.vue',
      '/src/views/Games/Simple.vue',
    ]);
    const routes = getRoutes(views, 'Games');
    // Only repeated names should be included
    expect(routes.map(r => r.path)).toContain('/games/GoombaRunner');
    expect(routes.map(r => r.path)).toContain('/games/ChickRun');
    expect(routes.map(r => r.path)).toContain('/games/Simple');
    expect(routes.map(r => r.path)).not.toContain('/games/Somethingelse');
    expect(routes.map(r => r.path)).not.toContain('/games/Other');
    // No duplicate for repeated
    expect(routes.filter(r => r.path === '/games/GoombaRunner').length).toBe(1);
    expect(routes.filter(r => r.path === '/games/ChickRun').length).toBe(1);
  });

  it('handles index.vue as base route', () => {
    const views = makeViews([
      '/src/views/Games/GoombaRunner/index.vue',
      '/src/views/Games/ChickRun/index.vue',
    ]);
    const routes = getRoutes(views, 'Games');
    expect(routes.map(r => r.path)).toContain('/games/GoombaRunner');
    expect(routes.map(r => r.path)).toContain('/games/ChickRun');
  });
});
