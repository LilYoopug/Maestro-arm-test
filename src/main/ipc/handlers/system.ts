/**
 * System IPC Handlers
 *
 * This module handles IPC calls for system-level operations:
 * - Dialog: folder selection
 * - Fonts: system font detection
 * - Shells: available shell detection, open external URLs
 * - Tunnel: Cloudflare tunnel management
 * - DevTools: developer tools control
 * - Updates: update checking
 * - Logger: logging operations
 *
 * Extracted from main/index.ts to improve code organization.
 */

import { ipcMain, dialog, shell, BrowserWindow, App } from 'electron';
import Store from 'electron-store';
import { execFileNoThrow } from '../../utils/execFile';
import { logger } from '../../utils/logger';
import { detectShells } from '../../utils/shellDetector';
import { isCloudflaredInstalled } from '../../utils/cliDetection';
import { tunnelManager as tunnelManagerInstance } from '../../tunnel-manager';
import { checkForUpdates } from '../../update-checker';
import { WebServer } from '../../web-server';

// Type for tunnel manager instance
type TunnelManagerType = typeof tunnelManagerInstance;

/**
 * Interface for Maestro settings store (subset needed for system handlers)
 */
interface MaestroSettings {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogBuffer?: number;
  [key: string]: any;
}

/**
 * Dependencies required for system handlers
 */
export interface SystemHandlerDependencies {
  getMainWindow: () => BrowserWindow | null;
  app: App;
  settingsStore: Store<MaestroSettings>;
  tunnelManager: TunnelManagerType;
  getWebServer: () => WebServer | null;
}

/**
 * Register all system-related IPC handlers.
 */
export function registerSystemHandlers(deps: SystemHandlerDependencies): void {
  const { getMainWindow, app, settingsStore, tunnelManager, getWebServer } = deps;

  // ============ Dialog Handlers ============

  // Folder selection dialog
  ipcMain.handle('dialog:selectFolder', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Working Directory',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // ============ Font Detection Handlers ============

  // Font detection
  ipcMain.handle('fonts:detect', async () => {
    try {
      // Use fc-list on all platforms (faster than system_profiler on macOS)
      // macOS: 0.74s (was 8.77s with system_profiler) - 11.9x faster
      // Linux/Windows: 0.5-0.6s
      const result = await execFileNoThrow('fc-list', [':', 'family']);

      if (result.exitCode === 0 && result.stdout) {
        // Parse font list and deduplicate
        const fonts = result.stdout
          .split('\n')
          .filter(Boolean)
          .map((line: string) => line.trim())
          .filter(font => font.length > 0);

        // Deduplicate fonts (fc-list can return duplicates)
        return [...new Set(fonts)];
      }

      // Fallback if fc-list not available (rare on modern systems)
      return ['Monaco', 'Menlo', 'Courier New', 'Consolas', 'Roboto Mono', 'Fira Code', 'JetBrains Mono'];
    } catch (error) {
      console.error('Font detection error:', error);
      // Return common monospace fonts as fallback
      return ['Monaco', 'Menlo', 'Courier New', 'Consolas', 'Roboto Mono', 'Fira Code', 'JetBrains Mono'];
    }
  });

  // ============ Shell Detection Handlers ============

  // Shell detection
  ipcMain.handle('shells:detect', async () => {
    try {
      logger.info('Detecting available shells', 'ShellDetector');
      const shells = await detectShells();
      logger.info(`Detected ${shells.filter(s => s.available).length} available shells`, 'ShellDetector', {
        shells: shells.filter(s => s.available).map(s => s.id)
      });
      return shells;
    } catch (error) {
      logger.error('Shell detection error', 'ShellDetector', error);
      // Return default shell list with all marked as unavailable
      return [
        { id: 'zsh', name: 'Zsh', available: false },
        { id: 'bash', name: 'Bash', available: false },
        { id: 'sh', name: 'Bourne Shell (sh)', available: false },
        { id: 'fish', name: 'Fish', available: false },
        { id: 'tcsh', name: 'Tcsh', available: false },
      ];
    }
  });

  // Shell operations - open external URLs
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // ============ Tunnel Handlers (Cloudflare) ============

  ipcMain.handle('tunnel:isCloudflaredInstalled', async () => {
    return await isCloudflaredInstalled();
  });

  ipcMain.handle('tunnel:start', async () => {
    const webServer = getWebServer();
    // Get web server URL (includes the security token)
    const serverUrl = webServer?.getSecureUrl();
    if (!serverUrl) {
      return { success: false, error: 'Web server not running' };
    }

    // Parse the URL to get port and token path
    const parsedUrl = new URL(serverUrl);
    const port = parseInt(parsedUrl.port, 10);
    const tokenPath = parsedUrl.pathname; // e.g., "/7d7f7162-614c-43e2-bb8a-8a8123c2f56a"

    const result = await tunnelManager.start(port);

    if (result.success && result.url) {
      // Append the token path to the tunnel URL for security
      // e.g., "https://xyz.trycloudflare.com" + "/TOKEN" = "https://xyz.trycloudflare.com/TOKEN"
      const fullTunnelUrl = result.url + tokenPath;
      return { success: true, url: fullTunnelUrl };
    }

    return result;
  });

  ipcMain.handle('tunnel:stop', async () => {
    await tunnelManager.stop();
    return { success: true };
  });

  ipcMain.handle('tunnel:getStatus', async () => {
    return tunnelManager.getStatus();
  });

  // ============ DevTools Handlers ============

  ipcMain.handle('devtools:open', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
    }
  });

  ipcMain.handle('devtools:close', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.closeDevTools();
    }
  });

  ipcMain.handle('devtools:toggle', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // ============ Update Check Handler ============

  ipcMain.handle('updates:check', async () => {
    const currentVersion = app.getVersion();
    return checkForUpdates(currentVersion);
  });

  // ============ Logger Handlers ============

  ipcMain.handle('logger:log', async (_event, level: string, message: string, context?: string, data?: unknown) => {
    const logLevel = level as 'debug' | 'info' | 'warn' | 'error' | 'toast' | 'autorun';
    switch (logLevel) {
      case 'debug':
        logger.debug(message, context, data);
        break;
      case 'info':
        logger.info(message, context, data);
        break;
      case 'warn':
        logger.warn(message, context, data);
        break;
      case 'error':
        logger.error(message, context, data);
        break;
      case 'toast':
        logger.toast(message, context, data);
        break;
      case 'autorun':
        logger.autorun(message, context, data);
        break;
    }
  });

  ipcMain.handle('logger:getLogs', async (_event, filter?: { level?: string; context?: string; limit?: number }) => {
    const typedFilter = filter ? {
      level: filter.level as 'debug' | 'info' | 'warn' | 'error' | 'toast' | 'autorun' | undefined,
      context: filter.context,
      limit: filter.limit,
    } : undefined;
    return logger.getLogs(typedFilter);
  });

  ipcMain.handle('logger:clearLogs', async () => {
    logger.clearLogs();
  });

  ipcMain.handle('logger:setLogLevel', async (_event, level: string) => {
    const logLevel = level as 'debug' | 'info' | 'warn' | 'error';
    logger.setLogLevel(logLevel);
    settingsStore.set('logLevel', logLevel);
  });

  ipcMain.handle('logger:getLogLevel', async () => {
    return logger.getLogLevel();
  });

  ipcMain.handle('logger:setMaxLogBuffer', async (_event, max: number) => {
    logger.setMaxLogBuffer(max);
    settingsStore.set('maxLogBuffer', max);
  });

  ipcMain.handle('logger:getMaxLogBuffer', async () => {
    return logger.getMaxLogBuffer();
  });
}

/**
 * Setup logger event forwarding to renderer.
 * This should be called after the main window is created.
 */
export function setupLoggerEventForwarding(getMainWindow: () => BrowserWindow | null): void {
  logger.on('newLog', (entry) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('logger:newLog', entry);
    }
  });
}
