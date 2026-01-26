import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimelineLogger } from './TimelineLogger';
import type { TimelineLogEntry } from './TimelineLogger';
import type { Timeline } from './types';

describe('TimelineLogger', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('log', () => {
    it('should add log entry with timestamp', () => {
      const logger = createTimelineLogger();

      logger.log({
        frame: 10,
        actionId: 'test-id',
        actionName: 'test-action',
        type: 'start',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].frame).toBe(10);
      expect(logs[0].actionId).toBe('test-id');
      expect(logs[0].actionName).toBe('test-action');
      expect(logs[0].type).toBe('start');
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should log different event types', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id1', type: 'execute' });
      logger.log({ frame: 10, actionId: 'id1', type: 'complete' });
      logger.log({ frame: 15, actionId: 'id1', type: 'remove' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].type).toBe('start');
      expect(logs[1].type).toBe('execute');
      expect(logs[2].type).toBe('complete');
      expect(logs[3].type).toBe('remove');
    });

    it('should include category and metadata', () => {
      const logger = createTimelineLogger();
      const metadata = { reason: 'user-triggered' };

      logger.log({
        frame: 10,
        actionId: 'test-id',
        category: 'physics',
        type: 'start',
        metadata,
      });

      const logs = logger.getLogs();
      expect(logs[0].category).toBe('physics');
      expect(logs[0].metadata).toEqual(metadata);
    });
  });

  describe('category filtering', () => {
    it('should filter logs by category when specified', () => {
      const logger = createTimelineLogger({
        categories: ['physics'],
      });

      logger.log({ frame: 0, actionId: 'id1', category: 'physics', type: 'start' });
      logger.log({ frame: 0, actionId: 'id2', category: 'ui', type: 'start' });
      logger.log({ frame: 0, actionId: 'id3', category: 'physics', type: 'start' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      logs.forEach(log => expect(log.category).toBe('physics'));
    });

    it('should log all categories when filter is empty', () => {
      const logger = createTimelineLogger({ categories: [] });

      logger.log({ frame: 0, actionId: 'id1', category: 'physics', type: 'start' });
      logger.log({ frame: 0, actionId: 'id2', category: 'ui', type: 'start' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
    });

    it('should log entries without category when filter is empty', () => {
      const logger = createTimelineLogger({ categories: [] });

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
    });

    it('should not log entries without category when filter is specified', () => {
      const logger = createTimelineLogger({ categories: ['physics'] });

      logger.log({ frame: 0, actionId: 'id1', type: 'start' }); // No category

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('getLogs with filtering', () => {
    beforeEach(() => {
      // Clear console spy before each test
      consoleLogSpy.mockClear();
    });

    it('should return all logs without filter', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', type: 'execute' });
      logger.log({ frame: 10, actionId: 'id3', type: 'complete' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('should filter by type', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', type: 'start' });
      logger.log({ frame: 10, actionId: 'id3', type: 'complete' });

      const startLogs = logger.getLogs({ type: 'start' });
      expect(startLogs).toHaveLength(2);
      startLogs.forEach(log => expect(log.type).toBe('start'));
    });

    it('should filter by category', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', category: 'physics', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', category: 'ui', type: 'start' });
      logger.log({ frame: 10, actionId: 'id3', category: 'physics', type: 'complete' });

      const physicsLogs = logger.getLogs({ category: 'physics' });
      expect(physicsLogs).toHaveLength(2);
      physicsLogs.forEach(log => expect(log.category).toBe('physics'));
    });

    it('should filter by both type and category', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', category: 'physics', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', category: 'physics', type: 'complete' });
      logger.log({ frame: 10, actionId: 'id3', category: 'ui', type: 'start' });

      const filtered = logger.getLogs({ category: 'physics', type: 'start' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe('physics');
      expect(filtered[0].type).toBe('start');
    });
  });

  describe('getActiveActions', () => {
    it('should return actions that started but not completed', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', type: 'start' });
      logger.log({ frame: 10, actionId: 'id1', type: 'complete' });

      const activeAt15 = logger.getActiveActions(15);
      const activeIds = new Set(activeAt15.map(entry => entry.actionId));

      expect(activeIds.has('id2')).toBe(true);
      expect(activeIds.has('id1')).toBe(false); // Completed
    });

    it('should not include actions that start after the frame', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 20, actionId: 'id2', type: 'start' });

      const activeAt10 = logger.getActiveActions(10);
      const activeIds = new Set(activeAt10.map(entry => entry.actionId));

      expect(activeIds.has('id1')).toBe(true);
      expect(activeIds.has('id2')).toBe(false); // Starts later
    });

    it('should return empty array when no actions are active', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 10, actionId: 'id1', type: 'complete' });

      const activeAt20 = logger.getActiveActions(20);
      expect(activeAt20).toHaveLength(0);
    });

    it('should handle multiple concurrent active actions', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', type: 'start' });
      logger.log({ frame: 10, actionId: 'id3', type: 'start' });

      const activeAt15 = logger.getActiveActions(15);
      const activeIds = new Set(activeAt15.map(entry => entry.actionId));

      expect(activeIds.size).toBe(3);
      expect(activeIds.has('id1')).toBe(true);
      expect(activeIds.has('id2')).toBe(true);
      expect(activeIds.has('id3')).toBe(true);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      const logger = createTimelineLogger();

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 5, actionId: 'id2', type: 'start' });

      logger.clearLogs();

      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('maxLogs limit', () => {
    it('should trim logs when exceeding maxLogs', () => {
      const logger = createTimelineLogger({ maxLogs: 3 });

      logger.log({ frame: 0, actionId: 'id1', type: 'start' });
      logger.log({ frame: 1, actionId: 'id2', type: 'start' });
      logger.log({ frame: 2, actionId: 'id3', type: 'start' });
      logger.log({ frame: 3, actionId: 'id4', type: 'start' }); // Exceeds limit

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
      // Should keep most recent logs
      expect(logs[0].actionId).toBe('id2');
      expect(logs[1].actionId).toBe('id3');
      expect(logs[2].actionId).toBe('id4');
    });

    it('should default to 1000 max logs', () => {
      const logger = createTimelineLogger();

      // Add 1001 logs
      for (let i = 0; i < 1001; i++) {
        logger.log({ frame: i, actionId: `id${i}`, type: 'start' });
      }

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1000);
    });
  });

  describe('formatConsoleOutput', () => {
    it('should format start event with icon', () => {
      const logger = createTimelineLogger();
      const entry: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 10,
        actionId: 'test-id',
        actionName: 'test-action',
        type: 'start',
      };

      const formatted = logger.formatConsoleOutput(entry);

      expect(formatted).toContain('▶️');
      expect(formatted).toContain('[Frame 10]');
      expect(formatted).toContain('test-action');
      expect(formatted).toContain('(start)');
    });

    it('should format execute event with icon', () => {
      const logger = createTimelineLogger();
      const entry: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 5,
        actionId: 'test-id',
        type: 'execute',
      };

      const formatted = logger.formatConsoleOutput(entry);

      expect(formatted).toContain('🏃');
      expect(formatted).toContain('(execute)');
    });

    it('should format complete event with icon', () => {
      const logger = createTimelineLogger();
      const entry: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 20,
        actionId: 'test-id',
        type: 'complete',
      };

      const formatted = logger.formatConsoleOutput(entry);

      expect(formatted).toContain('✅');
      expect(formatted).toContain('(complete)');
    });

    it('should format remove event with icon', () => {
      const logger = createTimelineLogger();
      const entry: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 15,
        actionId: 'test-id',
        type: 'remove',
      };

      const formatted = logger.formatConsoleOutput(entry);

      expect(formatted).toContain('🗑️');
      expect(formatted).toContain('(remove)');
    });

    it('should include category in output', () => {
      const logger = createTimelineLogger();
      const entry: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 10,
        actionId: 'test-id',
        category: 'physics',
        type: 'start',
      };

      const formatted = logger.formatConsoleOutput(entry);

      expect(formatted).toContain('[physics]');
    });

    it('should use action name if available, otherwise truncated ID', () => {
      const logger = createTimelineLogger();

      const entryWithName: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 10,
        actionId: 'very-long-action-id-12345',
        actionName: 'MyAction',
        type: 'start',
      };

      const entryWithoutName: TimelineLogEntry = {
        timestamp: Date.now(),
        frame: 10,
        actionId: 'very-long-action-id-12345',
        type: 'start',
      };

      const formattedWithName = logger.formatConsoleOutput(entryWithName);
      const formattedWithoutName = logger.formatConsoleOutput(entryWithoutName);

      expect(formattedWithName).toContain('MyAction');
      expect(formattedWithoutName).toContain('very-lon'); // Truncated to 8 chars
    });
  });

  describe('consoleOutput option', () => {
    it('should output to console when consoleOutput is true', () => {
      const logger = createTimelineLogger({ consoleOutput: true });

      logger.log({
        frame: 10,
        actionId: 'test-id',
        actionName: 'test-action',
        type: 'start',
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('▶️');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test-action');
    });

    it('should not output to console by default', () => {
      const logger = createTimelineLogger();

      logger.log({
        frame: 10,
        actionId: 'test-id',
        type: 'start',
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('printSummary', () => {
    it('should print summary of active actions by category', () => {
      const logger = createTimelineLogger();
      const activeActions: Timeline[] = [
        { name: 'a1', category: 'physics', action: vi.fn() },
        { name: 'a2', category: 'physics', action: vi.fn() },
        { name: 'a3', category: 'ui', action: vi.fn() },
        { name: 'a4', action: vi.fn() }, // No category
      ];

      logger.printSummary(activeActions, 100);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n[Frame 100] Timeline Summary:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  physics: 2 active');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ui: 1 active');
      expect(consoleLogSpy).toHaveBeenCalledWith('  uncategorized: 1 active');
    });

    it('should handle empty active actions', () => {
      const logger = createTimelineLogger();

      logger.printSummary([], 50);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n[Frame 50] Timeline Summary:');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Only the header
    });
  });
});
