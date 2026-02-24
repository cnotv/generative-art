/**
 * Resolves the animation name to play based on currently active actions.
 * Priority: blocking actions (kick/punch/jump) > movement modifiers (roll/run) > idle.
 * "run" only applies when a movement direction is also active.
 */
export const getActionName = (actions: Record<string, unknown>): string => {
  if (actions["kick"]) return "kick";
  if (actions["punch"]) return "punch";
  if (actions["jump"]) return "jump";
  if (actions["move-up"] || actions["move-down"] || actions["move-left"] || actions["move-right"]) {
    if (actions["roll"]) return "roll";
    if (actions["run"]) return "running";
    return "walk2";
  }
  return "idle";
};
