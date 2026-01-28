import type { Timeline } from './types';
import { createTimelineLogger, type TimelineLogger } from './TimelineLogger';
import { generateTimelineId } from './actions';

export interface TimelineManager {
  addAction: (action: Timeline) => string;
  removeAction: (id: string) => boolean;
  updateAction: (id: string, updates: Partial<Timeline>) => boolean;
  hasAction: (id: string) => boolean;
  getAction: (id: string) => Timeline | undefined;
  addActions: (actions: Timeline[]) => string[];
  removeByCategory: (category: string) => number;
  removeCompleted: () => number;
  clearAll: () => void;
  getActiveActions: () => Timeline[];
  getActionsByCategory: (category: string) => Timeline[];
  getTimeline: () => Timeline[];
  _markCompleted: (id: string) => void;
  getLogger: () => TimelineLogger | null;
}

/**
 * Create a timeline manager for dynamic action management
 * @param options Manager configuration
 * @returns Manager instance with methods
 */
export const createTimelineManager = (options?: {
  enableLogging?: boolean;
  logCategories?: string[];
}): TimelineManager => {
  let timeline: Timeline[] = [];
  const activeActions = new Map<string, Timeline>();
  const completedActions = new Set<string>();
  const logger = options?.enableLogging
    ? createTimelineLogger({
        categories: options.logCategories,
        consoleOutput: true,
      })
    : null;

  /**
   * Add a timeline action
   * @param action Timeline action to add
   * @returns Generated or provided ID
   */
  const addAction = (action: Timeline): string => {
    const id = action.id || generateTimelineId();
    const actionWithId: Timeline = { ...action, id };

    timeline.push(actionWithId);
    activeActions.set(id, actionWithId);

    if (logger) {
      logger.log({
        frame: action.start || 0,
        actionId: id,
        actionName: action.name,
        category: action.category,
        type: 'start',
      });
    }

    return id;
  };

  /**
   * Remove a timeline action by ID
   * @param id Action ID
   * @returns True if removed, false if not found
   */
  const removeAction = (id: string): boolean => {
    const index = timeline.findIndex(a => a.id === id);
    if (index === -1) return false;

    const action = activeActions.get(id);
    timeline.splice(index, 1);
    activeActions.delete(id);
    completedActions.add(id);

    if (logger) {
      logger.log({
        frame: 0,
        actionId: id,
        actionName: action?.name,
        category: action?.category,
        type: 'remove',
      });
    }

    return true;
  };

  /**
   * Update a timeline action
   * @param id Action ID
   * @param updates Partial updates to apply
   * @returns True if updated, false if not found
   */
  const updateAction = (id: string, updates: Partial<Timeline>): boolean => {
    const action = activeActions.get(id);
    if (!action) return false;

    const updatedAction = { ...action, ...updates, id };
    const index = timeline.findIndex(a => a.id === id);

    if (index !== -1) {
      timeline[index] = updatedAction;
      activeActions.set(id, updatedAction);
      return true;
    }

    return false;
  };

  /**
   * Check if action exists
   * @param id Action ID
   * @returns True if action exists
   */
  const hasAction = (id: string): boolean => {
    return activeActions.has(id);
  };

  /**
   * Get action by ID
   * @param id Action ID
   * @returns Timeline action or undefined
   */
  const getAction = (id: string): Timeline | undefined => {
    return activeActions.get(id);
  };

  /**
   * Add multiple actions
   * @param actions Array of timeline actions
   * @returns Array of generated IDs
   */
  const addActions = (actions: Timeline[]): string[] => {
    return actions.map(action => addAction(action));
  };

  /**
   * Remove all actions in a category
   * @param category Category name
   * @returns Number of actions removed
   */
  const removeByCategory = (category: string): number => {
    const toRemove = timeline
      .filter(a => a.category === category)
      .map(a => a.id!)
      .filter(id => id !== undefined);

    toRemove.forEach(id => removeAction(id));
    return toRemove.length;
  };

  /**
   * Remove all completed actions
   * @returns Number of actions removed
   */
  const removeCompleted = (): number => {
    const count = completedActions.size;
    completedActions.forEach(id => {
      const index = timeline.findIndex(a => a.id === id);
      if (index !== -1) {
        timeline.splice(index, 1);
        activeActions.delete(id);
      }
    });
    completedActions.clear();
    return count;
  };

  /**
   * Clear all actions
   */
  const clearAll = (): void => {
    timeline = [];
    activeActions.clear();
    completedActions.clear();

    if (logger) {
      logger.clearLogs();
    }
  };

  /**
   * Get all active actions
   * @returns Array of active timeline actions
   */
  const getActiveActions = (): Timeline[] => {
    return [...timeline].filter(a => !completedActions.has(a.id!));
  };

  /**
   * Get actions by category
   * @param category Category name
   * @returns Array of timeline actions in category
   */
  const getActionsByCategory = (category: string): Timeline[] => {
    return timeline.filter(a => a.category === category);
  };

  /**
   * Get the timeline array (used by animateTimeline)
   * @returns Copy of timeline array
   */
  const getTimeline = (): Timeline[] => {
    return [...timeline];
  };

  /**
   * Mark action as completed (internal use)
   * @param id Action ID
   */
  const _markCompleted = (id: string): void => {
    completedActions.add(id);

    if (logger) {
      const action = activeActions.get(id);
      logger.log({
        frame: 0,
        actionId: id,
        actionName: action?.name,
        category: action?.category,
        type: 'complete',
      });
    }
  };

  /**
   * Get logger instance
   * @returns TimelineLogger or null
   */
  const getLogger = (): TimelineLogger | null => {
    return logger;
  };

  return {
    addAction,
    removeAction,
    updateAction,
    hasAction,
    getAction,
    addActions,
    removeByCategory,
    removeCompleted,
    clearAll,
    getActiveActions,
    getActionsByCategory,
    getTimeline,
    _markCompleted,
    getLogger,
  };
};
