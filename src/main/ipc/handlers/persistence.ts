/**
 * Persistence IPC Handlers
 *
 * This module handles IPC calls for:
 * - Settings: get/set/getAll
 * - Sessions: getAll/setAll
 * - Groups: getAll/setAll
 *
 * Extracted from main/index.ts to improve code organization.
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { logger } from '../../utils/logger';
import { getThemeById } from '../../themes';
import { WebServer } from '../../web-server';

/**
 * Interface for Maestro settings store
 */
export interface MaestroSettings {
  activeThemeId: string;
  llmProvider: string;
  modelSlug: string;
  apiKey: string;
  shortcuts: Record<string, any>;
  defaultAgent: string;
  fontSize: number;
  fontFamily: string;
  customFonts: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  defaultShell: string;
  webAuthEnabled: boolean;
  webAuthToken: string | null;
  [key: string]: any;
}

/**
 * Interface for sessions store
 */
export interface SessionsData {
  sessions: any[];
}

/**
 * Interface for groups store
 */
export interface GroupsData {
  groups: any[];
}

/**
 * Dependencies required for persistence handlers
 */
export interface PersistenceHandlerDependencies {
  settingsStore: Store<MaestroSettings>;
  sessionsStore: Store<SessionsData>;
  groupsStore: Store<GroupsData>;
  getWebServer: () => WebServer | null;
}

/**
 * Register all persistence-related IPC handlers.
 */
export function registerPersistenceHandlers(deps: PersistenceHandlerDependencies): void {
  const { settingsStore, sessionsStore, groupsStore, getWebServer } = deps;

  // Settings management
  ipcMain.handle('settings:get', async (_, key: string) => {
    const value = settingsStore.get(key);
    logger.debug(`Settings read: ${key}`, 'Settings', { key, value });
    return value;
  });

  ipcMain.handle('settings:set', async (_, key: string, value: any) => {
    settingsStore.set(key, value);
    logger.info(`Settings updated: ${key}`, 'Settings', { key, value });

    const webServer = getWebServer();
    // Broadcast theme changes to connected web clients
    if (key === 'activeThemeId' && webServer && webServer.getWebClientCount() > 0) {
      const theme = getThemeById(value);
      if (theme) {
        webServer.broadcastThemeChange(theme);
        logger.info(`Broadcasted theme change to web clients: ${value}`, 'WebServer');
      }
    }

    // Broadcast custom commands changes to connected web clients
    if (key === 'customAICommands' && webServer && webServer.getWebClientCount() > 0) {
      webServer.broadcastCustomCommands(value);
      logger.info(`Broadcasted custom commands change to web clients: ${value.length} commands`, 'WebServer');
    }

    return true;
  });

  ipcMain.handle('settings:getAll', async () => {
    const settings = settingsStore.store;
    logger.debug('All settings retrieved', 'Settings', { count: Object.keys(settings).length });
    return settings;
  });

  // Sessions persistence
  ipcMain.handle('sessions:getAll', async () => {
    return sessionsStore.get('sessions', []);
  });

  ipcMain.handle('sessions:setAll', async (_, sessions: any[]) => {
    // Debug: log autoRunFolderPath values received from renderer
    const autoRunPaths = sessions.map((s: any) => ({ id: s.id, name: s.name, autoRunFolderPath: s.autoRunFolderPath }));
    logger.debug('[Sessions:setAll] Received sessions with autoRunFolderPaths:', 'Sessions', autoRunPaths);

    // Get previous sessions to detect changes
    const previousSessions = sessionsStore.get('sessions', []);
    const previousSessionMap = new Map(previousSessions.map((s: any) => [s.id, s]));
    const currentSessionMap = new Map(sessions.map((s: any) => [s.id, s]));

    const webServer = getWebServer();
    // Detect and broadcast changes to web clients
    if (webServer && webServer.getWebClientCount() > 0) {
      // Check for state changes in existing sessions
      for (const session of sessions) {
        const prevSession = previousSessionMap.get(session.id);
        if (prevSession) {
          // Session exists - check if state changed
          if (prevSession.state !== session.state ||
              prevSession.inputMode !== session.inputMode ||
              prevSession.name !== session.name ||
              JSON.stringify(prevSession.cliActivity) !== JSON.stringify(session.cliActivity)) {
            webServer.broadcastSessionStateChange(session.id, session.state, {
              name: session.name,
              toolType: session.toolType,
              inputMode: session.inputMode,
              cwd: session.cwd,
              cliActivity: session.cliActivity,
            });
          }
        } else {
          // New session added
          webServer.broadcastSessionAdded({
            id: session.id,
            name: session.name,
            toolType: session.toolType,
            state: session.state,
            inputMode: session.inputMode,
            cwd: session.cwd,
          });
        }
      }

      // Check for removed sessions
      for (const prevSession of previousSessions) {
        if (!currentSessionMap.has(prevSession.id)) {
          webServer.broadcastSessionRemoved(prevSession.id);
        }
      }
    }

    sessionsStore.set('sessions', sessions);

    // Debug: verify what was stored
    const storedSessions = sessionsStore.get('sessions', []);
    const storedAutoRunPaths = storedSessions.map((s: any) => ({ id: s.id, name: s.name, autoRunFolderPath: s.autoRunFolderPath }));
    logger.debug('[Sessions:setAll] After store, autoRunFolderPaths:', 'Sessions', storedAutoRunPaths);

    return true;
  });

  // Groups persistence
  ipcMain.handle('groups:getAll', async () => {
    return groupsStore.get('groups', []);
  });

  ipcMain.handle('groups:setAll', async (_, groups: any[]) => {
    groupsStore.set('groups', groups);
    return true;
  });
}
