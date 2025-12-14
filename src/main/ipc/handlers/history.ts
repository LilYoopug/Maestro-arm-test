import { ipcMain } from 'electron';
import fsSync from 'fs';
import Store from 'electron-store';
import { logger } from '../../utils/logger';
import { HistoryEntry } from '../../../shared/types';

const LOG_CONTEXT = '[History]';

/**
 * Interface for history store data
 */
interface HistoryData {
  entries: HistoryEntry[];
}

/**
 * Dependencies required for history handler registration.
 * These are injected from the main module where they're defined.
 */
export interface HistoryHandlerDependencies {
  historyStore: Store<HistoryData>;
  getHistoryNeedsReload: () => boolean;
  setHistoryNeedsReload: (value: boolean) => void;
}

/**
 * Register all History-related IPC handlers.
 *
 * These handlers provide history persistence operations:
 * - Get all history entries (with optional project/session filtering)
 * - Force reload history from disk
 * - Add new history entry
 * - Clear history (all or by project)
 * - Delete individual history entry
 * - Update history entry (e.g., setting validated flag)
 */
export function registerHistoryHandlers(deps: HistoryHandlerDependencies): void {
  const { historyStore, getHistoryNeedsReload, setHistoryNeedsReload } = deps;

  // Get all history entries, optionally filtered by project and/or session
  ipcMain.handle('history:getAll', async (_event, projectPath?: string, sessionId?: string) => {
    // If external changes were detected, reload from disk
    let allEntries: HistoryEntry[];
    if (getHistoryNeedsReload()) {
      try {
        const historyFilePath = historyStore.path;
        const fileContent = fsSync.readFileSync(historyFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        allEntries = data.entries || [];
        // Update the in-memory store with fresh data
        historyStore.set('entries', allEntries);
        setHistoryNeedsReload(false);
        logger.debug('Reloaded history from disk after external change', LOG_CONTEXT);
      } catch (error) {
        logger.warn(`Failed to reload history from disk: ${error}`, LOG_CONTEXT);
        allEntries = historyStore.get('entries', []);
      }
    } else {
      allEntries = historyStore.get('entries', []);
    }
    let filteredEntries = allEntries;

    if (projectPath) {
      // Filter by project path
      filteredEntries = filteredEntries.filter(entry => entry.projectPath === projectPath);
    }

    if (sessionId) {
      // Filter by session ID, but also include legacy entries without a sessionId
      filteredEntries = filteredEntries.filter(entry => entry.sessionId === sessionId || !entry.sessionId);
    }

    return filteredEntries;
  });

  // Force reload history from disk (for manual refresh)
  ipcMain.handle('history:reload', async () => {
    try {
      const historyFilePath = historyStore.path;
      const fileContent = fsSync.readFileSync(historyFilePath, 'utf-8');
      const data = JSON.parse(fileContent);
      const entries = data.entries || [];
      historyStore.set('entries', entries);
      setHistoryNeedsReload(false);
      logger.debug('Force reloaded history from disk', LOG_CONTEXT);
      return true;
    } catch (error) {
      logger.warn(`Failed to force reload history from disk: ${error}`, LOG_CONTEXT);
      return false;
    }
  });

  // Add a new history entry
  ipcMain.handle('history:add', async (_event, entry: HistoryEntry) => {
    const entries = historyStore.get('entries', []);
    entries.unshift(entry); // Add to beginning (most recent first)
    // Keep only last 1000 entries to prevent unbounded growth
    const trimmedEntries = entries.slice(0, 1000);
    historyStore.set('entries', trimmedEntries);
    logger.info(`Added history entry: ${entry.type}`, LOG_CONTEXT, { summary: entry.summary });
    return true;
  });

  // Clear history entries (all or by project)
  ipcMain.handle('history:clear', async (_event, projectPath?: string) => {
    if (projectPath) {
      // Clear only entries for this project
      const entries = historyStore.get('entries', []);
      const filtered = entries.filter(entry => entry.projectPath !== projectPath);
      historyStore.set('entries', filtered);
      logger.info(`Cleared history for project: ${projectPath}`, LOG_CONTEXT);
    } else {
      // Clear all entries
      historyStore.set('entries', []);
      logger.info('Cleared all history', LOG_CONTEXT);
    }
    return true;
  });

  // Delete a single history entry by ID
  ipcMain.handle('history:delete', async (_event, entryId: string) => {
    const entries = historyStore.get('entries', []);
    const filtered = entries.filter(entry => entry.id !== entryId);
    if (filtered.length === entries.length) {
      logger.warn(`History entry not found: ${entryId}`, LOG_CONTEXT);
      return false;
    }
    historyStore.set('entries', filtered);
    logger.info(`Deleted history entry: ${entryId}`, LOG_CONTEXT);
    return true;
  });

  // Update a history entry (for setting validated flag, etc.)
  ipcMain.handle('history:update', async (_event, entryId: string, updates: Partial<HistoryEntry>) => {
    const entries = historyStore.get('entries', []);
    const index = entries.findIndex(entry => entry.id === entryId);
    if (index === -1) {
      logger.warn(`History entry not found for update: ${entryId}`, LOG_CONTEXT);
      return false;
    }
    // Merge updates into the existing entry
    entries[index] = { ...entries[index], ...updates };
    historyStore.set('entries', entries);
    logger.info(`Updated history entry: ${entryId}`, LOG_CONTEXT, { updates });
    return true;
  });
}
