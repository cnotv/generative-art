import type { Timeline } from './types';

/**
 * Timeline log entry structure
 */
export interface TimelineLogEntry {
  timestamp: number;
  frame: number;
  actionId: string;
  actionName?: string;
  category?: string;
  type: 'start' | 'execute' | 'complete' | 'remove';
  metadata?: any;
}

export interface TimelineLogger {
  log: (entry: Omit<TimelineLogEntry, 'timestamp'>) => void;
  getLogs: (filter?: { category?: string; type?: string }) => TimelineLogEntry[];
  getActiveActions: (frame: number) => TimelineLogEntry[];
  clearLogs: () => void;
  formatConsoleOutput: (entry: TimelineLogEntry) => string;
  printSummary: (activeActions: Timeline[], frame: number) => void;
}

/**
 * Create a timeline logger with category filtering and console output
 * @param options Logger configuration
 * @returns Logger instance with methods
 */
export const createTimelineLogger = (options?: {
  categories?: string[];
  maxLogs?: number;
  consoleOutput?: boolean;
}): TimelineLogger => {
  let logs: TimelineLogEntry[] = [];
  const categoriesFilter = new Set(options?.categories || []);
  const maxLogs = options?.maxLogs || 1000;
  const consoleOutput = options?.consoleOutput || false;

  /**
   * Format log entry for console output
   * @param entry Log entry
   * @returns Formatted string
   */
  const formatConsoleOutput = (entry: TimelineLogEntry): string => {
    const icon = entry.type === 'start' ? '▶️' :
                 entry.type === 'execute' ? '🏃' :
                 entry.type === 'complete' ? '✅' : '🗑️';
    const cat = entry.category ? `[${entry.category}]` : '';
    const name = entry.actionName || entry.actionId.substring(0, 8);
    return `${icon} [Frame ${entry.frame}] ${cat} ${name} (${entry.type})`;
  };

  /**
   * Log a timeline event
   * @param entry Log entry without timestamp
   */
  const log = (entry: Omit<TimelineLogEntry, 'timestamp'>): void => {
    // Filter by category if specified
    if (categoriesFilter.size > 0) {
      if (!entry.category || !categoriesFilter.has(entry.category)) return;
    }

    const fullEntry: TimelineLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    logs.push(fullEntry);

    // Trim logs if exceeds max
    if (logs.length > maxLogs) {
      logs = logs.slice(-maxLogs);
    }

    // Console output if enabled
    if (consoleOutput) {
      console.log(formatConsoleOutput(fullEntry));
    }
  };

  /**
   * Get logs with optional filtering
   * @param filter Filter criteria
   * @returns Filtered log entries
   */
  const getLogs = (filter?: { category?: string; type?: string }): TimelineLogEntry[] => {
    if (!filter) return [...logs];

    return logs.filter(entry => {
      if (filter.category && entry.category !== filter.category) return false;
      if (filter.type && entry.type !== filter.type) return false;
      return true;
    });
  };

  /**
   * Get actions that are currently active at a given frame
   * @param frame Frame number
   * @returns Active log entries
   */
  const getActiveActions = (frame: number): TimelineLogEntry[] => {
    // Get actions that started but haven't completed at this frame
    const started = new Set<string>();
    const completed = new Set<string>();

    logs.forEach(entry => {
      if (entry.frame <= frame) {
        if (entry.type === 'start') started.add(entry.actionId);
        if (entry.type === 'complete') completed.add(entry.actionId);
      }
    });

    const active = [...started].filter(id => !completed.has(id));
    return logs.filter(entry => active.includes(entry.actionId));
  };

  /**
   * Clear all logs
   */
  const clearLogs = (): void => {
    logs = [];
  };

  /**
   * Print summary of active actions by category
   * @param activeActions Array of active timeline actions
   * @param frame Current frame number
   */
  const printSummary = (activeActions: Timeline[], frame: number): void => {
    console.log(`\n[Frame ${frame}] Timeline Summary:`);

    const categories: Record<string, number> = {};
    activeActions.forEach(a => {
      const cat = a.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} active`);
    });
  };

  return {
    log,
    getLogs,
    getActiveActions,
    clearLogs,
    formatConsoleOutput,
    printSummary,
  };
};
