/**
 * Structured logging utility for the main process
 * Logs are stored in memory and can be retrieved via IPC
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'toast' | 'autorun';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries
  private minLevel: LogLevel = 'info'; // Default log level

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    toast: 1, // Toast notifications always logged at info priority (always visible)
    autorun: 1, // Auto Run logs always logged at info priority (always visible)
  };

  setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.minLevel;
  }

  setMaxLogBuffer(max: number): void {
    this.maxLogs = max;
    // Trim logs if current size exceeds new max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getMaxLogBuffer(): number {
    return this.maxLogs;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also output to console for development
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ''}`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'error':
        console.error(message, entry.data || '');
        break;
      case 'warn':
        console.warn(message, entry.data || '');
        break;
      case 'info':
        console.info(message, entry.data || '');
        break;
      case 'debug':
        console.log(message, entry.data || '');
        break;
      case 'toast':
        // Toast notifications logged with info styling (purple in LogViewer)
        console.info(message, entry.data || '');
        break;
      case 'autorun':
        // Auto Run logs for workflow tracking (orange in LogViewer)
        console.info(message, entry.data || '');
        break;
    }
  }

  debug(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return;
    this.addLog({
      timestamp: Date.now(),
      level: 'debug',
      message,
      context,
      data,
    });
  }

  info(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog('info')) return;
    this.addLog({
      timestamp: Date.now(),
      level: 'info',
      message,
      context,
      data,
    });
  }

  warn(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog('warn')) return;
    this.addLog({
      timestamp: Date.now(),
      level: 'warn',
      message,
      context,
      data,
    });
  }

  error(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog('error')) return;
    this.addLog({
      timestamp: Date.now(),
      level: 'error',
      message,
      context,
      data,
    });
  }

  toast(message: string, context?: string, data?: unknown): void {
    // Toast notifications are always logged (they're user-facing notifications)
    this.addLog({
      timestamp: Date.now(),
      level: 'toast',
      message,
      context,
      data,
    });
  }

  autorun(message: string, context?: string, data?: unknown): void {
    // Auto Run logs are always logged (workflow tracking cannot be turned off)
    this.addLog({
      timestamp: Date.now(),
      level: 'autorun',
      message,
      context,
      data,
    });
  }

  getLogs(filter?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      const minPriority = this.levelPriority[filter.level];
      filtered = filtered.filter(log => this.levelPriority[log.level] >= minPriority);
    }

    if (filter?.context) {
      filtered = filtered.filter(log => log.context === filter.context);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance
export const logger = new Logger();
