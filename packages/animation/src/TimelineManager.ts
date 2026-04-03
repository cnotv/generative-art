import type { Timeline } from './types'
import { createTimelineLogger, type TimelineLogger } from './TimelineLogger'
import { generateTimelineId } from './actions'

export interface TimelineManager {
  addAction: (action: Timeline) => string
  removeAction: (id: string) => boolean
  updateAction: (id: string, updates: Partial<Timeline>) => boolean
  hasAction: (id: string) => boolean
  getAction: (id: string) => Timeline | undefined
  addActions: (actions: Timeline[]) => string[]
  removeByCategory: (category: string) => number
  removeCompleted: () => number
  clearAll: () => void
  getActiveActions: () => Timeline[]
  getActionsByCategory: (category: string) => Timeline[]
  getTimeline: () => Timeline[]
  _markCompleted: (id: string) => void
  getLogger: () => TimelineLogger | null
}

interface TimelineState {
  timeline: Timeline[]
  activeActions: Map<string, Timeline>
  completedActions: Set<string>
  logger: TimelineLogger | null
}

const logActionStart = (state: TimelineState, action: Timeline, id: string): void => {
  state.logger?.log({
    frame: action.start || 0,
    actionId: id,
    actionName: action.name,
    category: action.category,
    type: 'start'
  })
}

const logActionRemove = (state: TimelineState, id: string, action: Timeline | undefined): void => {
  state.logger?.log({
    frame: 0,
    actionId: id,
    actionName: action?.name,
    category: action?.category,
    type: 'remove'
  })
}

const logActionComplete = (state: TimelineState, id: string): void => {
  const action = state.activeActions.get(id)
  state.logger?.log({
    frame: 0,
    actionId: id,
    actionName: action?.name,
    category: action?.category,
    type: 'complete'
  })
}

const buildActionMethods = (state: TimelineState) => {
  /**
   * Add a timeline action
   * @param action Timeline action to add
   * @returns Generated or provided ID
   */
  const addAction = (action: Timeline): string => {
    const id = action.id || generateTimelineId()
    const actionWithId: Timeline = { ...action, id }

    state.timeline.push(actionWithId)
    state.activeActions.set(id, actionWithId)
    logActionStart(state, action, id)

    return id
  }

  /**
   * Remove a timeline action by ID
   * @param id Action ID
   * @returns True if removed, false if not found
   */
  const removeAction = (id: string): boolean => {
    const index = state.timeline.findIndex((a) => a.id === id)
    if (index === -1) return false

    const action = state.activeActions.get(id)
    state.timeline.splice(index, 1)
    state.activeActions.delete(id)
    state.completedActions.add(id)
    logActionRemove(state, id, action)

    return true
  }

  /**
   * Update a timeline action
   * @param id Action ID
   * @param updates Partial updates to apply
   * @returns True if updated, false if not found
   */
  const updateAction = (id: string, updates: Partial<Timeline>): boolean => {
    const action = state.activeActions.get(id)
    if (!action) return false

    const updatedAction = { ...action, ...updates, id }
    const index = state.timeline.findIndex((a) => a.id === id)

    if (index !== -1) {
      state.timeline[index] = updatedAction
      state.activeActions.set(id, updatedAction)
      return true
    }

    return false
  }

  return { addAction, removeAction, updateAction }
}

const buildQueryMethods = (state: TimelineState) => {
  /** @returns True if action exists */
  const hasAction = (id: string): boolean => state.activeActions.has(id)

  /** @returns Timeline action or undefined */
  const getAction = (id: string): Timeline | undefined => state.activeActions.get(id)

  /** @returns Array of generated IDs */
  const addActions = (actions: Timeline[]): string[] =>
    actions.map((action) => buildActionMethods(state).addAction(action))

  /** @returns Number of actions removed */
  const removeByCategory = (category: string): number => {
    const toRemove = state.timeline
      .filter((a) => a.category === category)
      .map((a) => a.id!)
      .filter((id) => id !== undefined)

    toRemove.forEach((id) => buildActionMethods(state).removeAction(id))
    return toRemove.length
  }

  /** @returns Number of actions removed */
  const removeCompleted = (): number => {
    const count = state.completedActions.size
    state.completedActions.forEach((id) => {
      const index = state.timeline.findIndex((a) => a.id === id)
      if (index !== -1) {
        state.timeline.splice(index, 1)
        state.activeActions.delete(id)
      }
    })
    state.completedActions.clear()
    return count
  }

  const clearAll = (): void => {
    state.timeline.length = 0
    state.activeActions.clear()
    state.completedActions.clear()
    state.logger?.clearLogs()
  }

  /** @returns Array of active timeline actions */
  const getActiveActions = (): Timeline[] =>
    [...state.timeline].filter((a) => !state.completedActions.has(a.id!))

  /** @returns Array of timeline actions in category */
  const getActionsByCategory = (category: string): Timeline[] =>
    state.timeline.filter((a) => a.category === category)

  /** @returns Copy of timeline array */
  const getTimeline = (): Timeline[] => [...state.timeline]

  const _markCompleted = (id: string): void => {
    state.completedActions.add(id)
    logActionComplete(state, id)
  }

  const getLogger = (): TimelineLogger | null => state.logger

  return {
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
    getLogger
  }
}

/**
 * Create a timeline manager for dynamic action management
 * @param options Manager configuration
 * @returns Manager instance with methods
 */
export const createTimelineManager = (options?: {
  enableLogging?: boolean
  logCategories?: string[]
}): TimelineManager => {
  const state: TimelineState = {
    timeline: [],
    activeActions: new Map<string, Timeline>(),
    completedActions: new Set<string>(),
    logger: options?.enableLogging
      ? createTimelineLogger({
          categories: options.logCategories,
          consoleOutput: true
        })
      : null
  }

  const { addAction, removeAction, updateAction } = buildActionMethods(state)
  const queryMethods = buildQueryMethods(state)

  const addActions = (actions: Timeline[]): string[] => actions.map((action) => addAction(action))

  const removeByCategory = (category: string): number => {
    const toRemove = state.timeline
      .filter((a) => a.category === category)
      .map((a) => a.id!)
      .filter((id) => id !== undefined)

    toRemove.forEach((id) => removeAction(id))
    return toRemove.length
  }

  return {
    addAction,
    removeAction,
    updateAction,
    hasAction: queryMethods.hasAction,
    getAction: queryMethods.getAction,
    addActions,
    removeByCategory,
    removeCompleted: queryMethods.removeCompleted,
    clearAll: queryMethods.clearAll,
    getActiveActions: queryMethods.getActiveActions,
    getActionsByCategory: queryMethods.getActionsByCategory,
    getTimeline: queryMethods.getTimeline,
    _markCompleted: queryMethods._markCompleted,
    getLogger: queryMethods.getLogger
  }
}
