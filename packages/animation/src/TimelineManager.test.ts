import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTimelineManager } from './TimelineManager';
import type { Timeline } from './types';

describe('TimelineManager', () => {
  describe('addAction', () => {
    it('should add action and return generated ID', () => {
      const manager = createTimelineManager();
      const action: Timeline = {
        name: 'test-action',
        action: vi.fn(),
        start: 0,
      };

      const id = manager.addAction(action);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(manager.hasAction(id)).toBe(true);
    });

    it('should use provided ID if specified', () => {
      const manager = createTimelineManager();
      const customId = 'custom-id-123';
      const action: Timeline = {
        id: customId,
        name: 'test-action',
        action: vi.fn(),
      };

      const returnedId = manager.addAction(action);

      expect(returnedId).toBe(customId);
      expect(manager.hasAction(customId)).toBe(true);
    });

    it('should add action to timeline', () => {
      const manager = createTimelineManager();
      const action: Timeline = {
        name: 'test-action',
        action: vi.fn(),
        start: 10,
      };

      manager.addAction(action);
      const timeline = manager.getTimeline();

      expect(timeline).toHaveLength(1);
      expect(timeline[0].name).toBe('test-action');
      expect(timeline[0].start).toBe(10);
    });
  });

  describe('removeAction', () => {
    it('should remove action by ID', () => {
      const manager = createTimelineManager();
      const action: Timeline = { name: 'test', action: vi.fn() };
      const id = manager.addAction(action);

      const removed = manager.removeAction(id);

      expect(removed).toBe(true);
      expect(manager.hasAction(id)).toBe(false);
      expect(manager.getTimeline()).toHaveLength(0);
    });

    it('should return false when removing non-existent action', () => {
      const manager = createTimelineManager();
      const removed = manager.removeAction('non-existent-id');

      expect(removed).toBe(false);
    });

    it('should mark action as completed when removed', () => {
      const manager = createTimelineManager();
      const action: Timeline = { name: 'test', action: vi.fn() };
      const id = manager.addAction(action);

      manager.removeAction(id);
      const activeActions = manager.getActiveActions();

      expect(activeActions).toHaveLength(0);
    });
  });

  describe('updateAction', () => {
    it('should update action properties', () => {
      const manager = createTimelineManager();
      const action: Timeline = {
        name: 'test',
        action: vi.fn(),
        start: 10,
        enabled: true,
      };
      const id = manager.addAction(action);

      const updated = manager.updateAction(id, {
        start: 20,
        enabled: false,
      });

      expect(updated).toBe(true);
      const updatedAction = manager.getAction(id);
      expect(updatedAction?.start).toBe(20);
      expect(updatedAction?.enabled).toBe(false);
    });

    it('should return false when updating non-existent action', () => {
      const manager = createTimelineManager();
      const updated = manager.updateAction('non-existent', { start: 10 });

      expect(updated).toBe(false);
    });

    it('should preserve action ID when updating', () => {
      const manager = createTimelineManager();
      const action: Timeline = { name: 'test', action: vi.fn() };
      const id = manager.addAction(action);

      manager.updateAction(id, { name: 'updated' });
      const updatedAction = manager.getAction(id);

      expect(updatedAction?.id).toBe(id);
    });
  });

  describe('hasAction and getAction', () => {
    it('should check if action exists', () => {
      const manager = createTimelineManager();
      const action: Timeline = { name: 'test', action: vi.fn() };
      const id = manager.addAction(action);

      expect(manager.hasAction(id)).toBe(true);
      expect(manager.hasAction('non-existent')).toBe(false);
    });

    it('should retrieve action by ID', () => {
      const manager = createTimelineManager();
      const actionFunction = vi.fn();
      const action: Timeline = {
        name: 'test-action',
        action: actionFunction,
        start: 10,
      };
      const id = manager.addAction(action);

      const retrieved = manager.getAction(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-action');
      expect(retrieved?.start).toBe(10);
      expect(retrieved?.action).toBe(actionFunction);
    });

    it('should return undefined for non-existent action', () => {
      const manager = createTimelineManager();
      const retrieved = manager.getAction('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('addActions', () => {
    it('should add multiple actions and return IDs', () => {
      const manager = createTimelineManager();
      const actions: Timeline[] = [
        { name: 'action1', action: vi.fn() },
        { name: 'action2', action: vi.fn() },
        { name: 'action3', action: vi.fn() },
      ];

      const ids = manager.addActions(actions);

      expect(ids).toHaveLength(3);
      expect(manager.getTimeline()).toHaveLength(3);
      ids.forEach(id => expect(manager.hasAction(id)).toBe(true));
    });

    it('should handle empty array', () => {
      const manager = createTimelineManager();
      const ids = manager.addActions([]);

      expect(ids).toHaveLength(0);
      expect(manager.getTimeline()).toHaveLength(0);
    });
  });

  describe('removeByCategory', () => {
    it('should remove all actions in a category', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', category: 'physics', action: vi.fn() });
      manager.addAction({ name: 'a2', category: 'physics', action: vi.fn() });
      manager.addAction({ name: 'a3', category: 'ui', action: vi.fn() });

      const removed = manager.removeByCategory('physics');

      expect(removed).toBe(2);
      expect(manager.getTimeline()).toHaveLength(1);
      expect(manager.getActionsByCategory('physics')).toHaveLength(0);
    });

    it('should return 0 when category not found', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', category: 'physics', action: vi.fn() });

      const removed = manager.removeByCategory('non-existent');

      expect(removed).toBe(0);
    });
  });

  describe('removeCompleted', () => {
    it('should remove all marked completed actions', () => {
      const manager = createTimelineManager();
      const id1 = manager.addAction({ name: 'a1', action: vi.fn() });
      const id2 = manager.addAction({ name: 'a2', action: vi.fn() });
      const id3 = manager.addAction({ name: 'a3', action: vi.fn() });

      // Mark as completed (internal)
      manager._markCompleted(id1);
      manager._markCompleted(id2);

      const removed = manager.removeCompleted();

      expect(removed).toBe(2);
      expect(manager.getTimeline()).toHaveLength(1);
      expect(manager.hasAction(id3)).toBe(true);
    });

    it('should return 0 when no completed actions', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', action: vi.fn() });

      const removed = manager.removeCompleted();

      expect(removed).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all actions', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', action: vi.fn() });
      manager.addAction({ name: 'a2', action: vi.fn() });

      manager.clearAll();

      expect(manager.getTimeline()).toHaveLength(0);
      expect(manager.getActiveActions()).toHaveLength(0);
    });
  });

  describe('getActiveActions', () => {
    it('should return only non-completed actions', () => {
      const manager = createTimelineManager();
      const id1 = manager.addAction({ name: 'a1', action: vi.fn() });
      const id2 = manager.addAction({ name: 'a2', action: vi.fn() });
      manager.addAction({ name: 'a3', action: vi.fn() });

      manager._markCompleted(id1);
      manager._markCompleted(id2);

      const active = manager.getActiveActions();

      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('a3');
    });

    it('should return all actions when none completed', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', action: vi.fn() });
      manager.addAction({ name: 'a2', action: vi.fn() });

      const active = manager.getActiveActions();

      expect(active).toHaveLength(2);
    });
  });

  describe('getActionsByCategory', () => {
    it('should filter actions by category', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', category: 'physics', action: vi.fn() });
      manager.addAction({ name: 'a2', category: 'ui', action: vi.fn() });
      manager.addAction({ name: 'a3', category: 'physics', action: vi.fn() });

      const physicsActions = manager.getActionsByCategory('physics');

      expect(physicsActions).toHaveLength(2);
      physicsActions.forEach(a => expect(a.category).toBe('physics'));
    });

    it('should return empty array for non-existent category', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', category: 'physics', action: vi.fn() });

      const actions = manager.getActionsByCategory('non-existent');

      expect(actions).toHaveLength(0);
    });
  });

  describe('getTimeline', () => {
    it('should return copy of timeline array', () => {
      const manager = createTimelineManager();
      manager.addAction({ name: 'a1', action: vi.fn() });
      manager.addAction({ name: 'a2', action: vi.fn() });

      const timeline = manager.getTimeline();

      expect(timeline).toHaveLength(2);
      // Modify returned array should not affect internal state
      timeline.push({ name: 'a3', action: vi.fn() });
      expect(manager.getTimeline()).toHaveLength(2);
    });
  });

  describe('with logger enabled', () => {
    it('should create logger when enableLogging is true', () => {
      const manager = createTimelineManager({ enableLogging: true });
      const logger = manager.getLogger();

      expect(logger).not.toBeNull();
    });

    it('should not create logger by default', () => {
      const manager = createTimelineManager();
      const logger = manager.getLogger();

      expect(logger).toBeNull();
    });

    it('should log action additions', () => {
      const manager = createTimelineManager({ enableLogging: true });
      const logger = manager.getLogger();

      manager.addAction({ name: 'test', category: 'physics', action: vi.fn() });

      const logs = logger?.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs?.[0].type).toBe('start');
      expect(logs?.[0].category).toBe('physics');
    });

    it('should log action removals', () => {
      const manager = createTimelineManager({ enableLogging: true });
      const logger = manager.getLogger();
      const id = manager.addAction({ name: 'test', action: vi.fn() });

      manager.removeAction(id);

      const logs = logger?.getLogs({ type: 'remove' });
      expect(logs).toHaveLength(1);
    });

    it('should clear logs when clearing all actions', () => {
      const manager = createTimelineManager({ enableLogging: true });
      const logger = manager.getLogger();
      manager.addAction({ name: 'test', action: vi.fn() });

      manager.clearAll();

      expect(logger?.getLogs()).toHaveLength(0);
    });
  });

  describe('integration with animateTimeline', () => {
    it('should work with animateTimeline for action execution', () => {
      const manager = createTimelineManager();
      const actionFunction = vi.fn();

      manager.addAction({
        name: 'test',
        start: 10,
        end: 20,
        action: actionFunction,
      });

      // Simulate animateTimeline usage
      const timeline = manager.getTimeline();
      expect(timeline).toHaveLength(1);
      expect(timeline[0].action).toBe(actionFunction);
    });

    it('should support frequency-based actions', () => {
      const manager = createTimelineManager();

      manager.addAction({
        name: 'frequent-action',
        frequency: 5,
        action: vi.fn(),
        category: 'user-input',
      });

      const timeline = manager.getTimeline();
      expect(timeline[0].frequency).toBe(5);
    });
  });
});
