import { ipcMain, BrowserWindow, App, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[Playbooks]';

/**
 * Dependencies required for playbooks handler registration
 */
export interface PlaybooksHandlerDependencies {
  mainWindow: BrowserWindow | null;
  getMainWindow: () => BrowserWindow | null;
  app: App;
}

/**
 * Get path to playbooks file for a session
 */
function getPlaybooksFilePath(app: App, sessionId: string): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'playbooks', `${sessionId}.json`);
}

/**
 * Read playbooks from file
 */
async function readPlaybooks(app: App, sessionId: string): Promise<any[]> {
  const filePath = getPlaybooksFilePath(app, sessionId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.playbooks) ? data.playbooks : [];
  } catch {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

/**
 * Write playbooks to file
 */
async function writePlaybooks(app: App, sessionId: string, playbooks: any[]): Promise<void> {
  const filePath = getPlaybooksFilePath(app, sessionId);
  const dir = path.dirname(filePath);

  // Ensure the playbooks directory exists
  await fs.mkdir(dir, { recursive: true });

  // Write the playbooks file
  await fs.writeFile(filePath, JSON.stringify({ playbooks }, null, 2), 'utf-8');
}

/**
 * Register all Playbooks-related IPC handlers.
 *
 * These handlers provide playbook CRUD operations:
 * - List all playbooks for a session
 * - Create a new playbook
 * - Update an existing playbook
 * - Delete a playbook
 * - Export a playbook to ZIP file
 * - Import a playbook from ZIP file
 */
export function registerPlaybooksHandlers(deps: PlaybooksHandlerDependencies): void {
  const { getMainWindow, app } = deps;

  // List all playbooks for a session
  ipcMain.handle('playbooks:list', async (_event, sessionId: string) => {
    try {
      const playbooks = await readPlaybooks(app, sessionId);
      logger.info(`Listed ${playbooks.length} playbooks for session ${sessionId}`, LOG_CONTEXT);
      return { success: true, playbooks };
    } catch (error) {
      logger.error('Error listing playbooks', LOG_CONTEXT, error);
      return { success: false, playbooks: [], error: String(error) };
    }
  });

  // Create a new playbook
  ipcMain.handle(
    'playbooks:create',
    async (
      _event,
      sessionId: string,
      playbook: {
        name: string;
        documents: any[];
        loopEnabled: boolean;
        prompt: string;
        worktreeSettings?: {
          branchNameTemplate: string;
          createPROnCompletion: boolean;
          prTargetBranch?: string;
        };
      }
    ) => {
      try {
        const playbooks = await readPlaybooks(app, sessionId);

        // Create new playbook with generated ID and timestamps
        const now = Date.now();
        const newPlaybook: {
          id: string;
          name: string;
          createdAt: number;
          updatedAt: number;
          documents: any[];
          loopEnabled: boolean;
          prompt: string;
          worktreeSettings?: {
            branchNameTemplate: string;
            createPROnCompletion: boolean;
            prTargetBranch?: string;
          };
        } = {
          id: crypto.randomUUID(),
          name: playbook.name,
          createdAt: now,
          updatedAt: now,
          documents: playbook.documents,
          loopEnabled: playbook.loopEnabled,
          prompt: playbook.prompt,
        };

        // Include worktree settings if provided
        if (playbook.worktreeSettings) {
          newPlaybook.worktreeSettings = playbook.worktreeSettings;
        }

        // Add to list and save
        playbooks.push(newPlaybook);
        await writePlaybooks(app, sessionId, playbooks);

        logger.info(`Created playbook "${playbook.name}" for session ${sessionId}`, LOG_CONTEXT);
        return { success: true, playbook: newPlaybook };
      } catch (error) {
        logger.error('Error creating playbook', LOG_CONTEXT, error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Update an existing playbook
  ipcMain.handle(
    'playbooks:update',
    async (
      _event,
      sessionId: string,
      playbookId: string,
      updates: Partial<{
        name: string;
        documents: any[];
        loopEnabled: boolean;
        prompt: string;
        updatedAt: number;
        worktreeSettings?: {
          branchNameTemplate: string;
          createPROnCompletion: boolean;
          prTargetBranch?: string;
        };
      }>
    ) => {
      try {
        const playbooks = await readPlaybooks(app, sessionId);

        // Find the playbook to update
        const index = playbooks.findIndex((p: any) => p.id === playbookId);
        if (index === -1) {
          return { success: false, error: 'Playbook not found' };
        }

        // Update the playbook
        const updatedPlaybook = {
          ...playbooks[index],
          ...updates,
          updatedAt: Date.now(),
        };
        playbooks[index] = updatedPlaybook;

        await writePlaybooks(app, sessionId, playbooks);

        logger.info(`Updated playbook "${updatedPlaybook.name}" for session ${sessionId}`, LOG_CONTEXT);
        return { success: true, playbook: updatedPlaybook };
      } catch (error) {
        logger.error('Error updating playbook', LOG_CONTEXT, error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Delete a playbook
  ipcMain.handle('playbooks:delete', async (_event, sessionId: string, playbookId: string) => {
    try {
      const playbooks = await readPlaybooks(app, sessionId);

      // Find the playbook to delete
      const index = playbooks.findIndex((p: any) => p.id === playbookId);
      if (index === -1) {
        return { success: false, error: 'Playbook not found' };
      }

      const deletedName = playbooks[index].name;

      // Remove from list and save
      playbooks.splice(index, 1);
      await writePlaybooks(app, sessionId, playbooks);

      logger.info(`Deleted playbook "${deletedName}" from session ${sessionId}`, LOG_CONTEXT);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting playbook', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Export a playbook as a ZIP file
  ipcMain.handle(
    'playbooks:export',
    async (
      _event,
      sessionId: string,
      playbookId: string,
      autoRunFolderPath: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        const playbooks = await readPlaybooks(app, sessionId);
        const playbook = playbooks.find((p: any) => p.id === playbookId);

        if (!playbook) {
          return { success: false, error: 'Playbook not found' };
        }

        const mainWindow = getMainWindow();
        if (!mainWindow) {
          return { success: false, error: 'No main window available' };
        }

        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Export Playbook',
          defaultPath: `${playbook.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.maestro-playbook.zip`,
          filters: [
            { name: 'Maestro Playbook', extensions: ['maestro-playbook.zip'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const zipPath = result.filePath;

        // Create ZIP archive
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Wait for archive to finish
        const archivePromise = new Promise<void>((resolve, reject) => {
          output.on('close', () => resolve());
          archive.on('error', (err) => reject(err));
        });

        archive.pipe(output);

        // Create manifest JSON (playbook settings without the id - will be regenerated on import)
        const manifest = {
          version: 1,
          name: playbook.name,
          documents: playbook.documents,
          loopEnabled: playbook.loopEnabled,
          maxLoops: playbook.maxLoops,
          prompt: playbook.prompt,
          worktreeSettings: playbook.worktreeSettings,
          exportedAt: Date.now()
        };

        // Add manifest to archive
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        // Add each document markdown file
        for (const doc of playbook.documents) {
          const docPath = path.join(autoRunFolderPath, `${doc.filename}.md`);
          try {
            const content = await fs.readFile(docPath, 'utf-8');
            archive.append(content, { name: `documents/${doc.filename}.md` });
          } catch (err) {
            // Document file doesn't exist, skip it but log warning
            logger.warn(`Document ${doc.filename}.md not found during export`, LOG_CONTEXT);
          }
        }

        // Finalize archive
        await archive.finalize();
        await archivePromise;

        logger.info(`Exported playbook "${playbook.name}" to ${zipPath}`, LOG_CONTEXT);
        return { success: true, filePath: zipPath };
      } catch (error) {
        logger.error('Error exporting playbook', LOG_CONTEXT, error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Import a playbook from a ZIP file
  ipcMain.handle(
    'playbooks:import',
    async (
      _event,
      sessionId: string,
      autoRunFolderPath: string
    ): Promise<{ success: boolean; playbook?: any; importedDocs?: string[]; error?: string }> => {
      try {
        const mainWindow = getMainWindow();
        if (!mainWindow) {
          return { success: false, error: 'No main window available' };
        }

        // Show open dialog
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Import Playbook',
          filters: [
            { name: 'Maestro Playbook', extensions: ['maestro-playbook.zip', 'zip'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, error: 'Import cancelled' };
        }

        const zipPath = result.filePaths[0];

        // Read ZIP file
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // Find and parse manifest
        const manifestEntry = zipEntries.find(e => e.entryName === 'manifest.json');
        if (!manifestEntry) {
          return { success: false, error: 'Invalid playbook file: missing manifest.json' };
        }

        const manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));

        // Validate manifest
        if (!manifest.name || !Array.isArray(manifest.documents)) {
          return { success: false, error: 'Invalid playbook manifest' };
        }

        // Extract document files to autorun folder
        const importedDocs: string[] = [];
        for (const entry of zipEntries) {
          if (entry.entryName.startsWith('documents/') && entry.entryName.endsWith('.md')) {
            const filename = path.basename(entry.entryName);
            const destPath = path.join(autoRunFolderPath, filename);

            // Ensure autorun folder exists
            await fs.mkdir(autoRunFolderPath, { recursive: true });

            // Write document file
            await fs.writeFile(destPath, entry.getData().toString('utf-8'), 'utf-8');
            importedDocs.push(filename.replace('.md', ''));
          }
        }

        // Create new playbook entry
        const playbooks = await readPlaybooks(app, sessionId);
        const now = Date.now();

        const newPlaybook = {
          id: crypto.randomUUID(),
          name: manifest.name,
          createdAt: now,
          updatedAt: now,
          documents: manifest.documents,
          loopEnabled: manifest.loopEnabled ?? false,
          maxLoops: manifest.maxLoops,
          prompt: manifest.prompt || '',
          worktreeSettings: manifest.worktreeSettings
        };

        // Add to list and save
        playbooks.push(newPlaybook);
        await writePlaybooks(app, sessionId, playbooks);

        logger.info(`Imported playbook "${manifest.name}" with ${importedDocs.length} documents`, LOG_CONTEXT);
        return { success: true, playbook: newPlaybook, importedDocs };
      } catch (error) {
        logger.error('Error importing playbook', LOG_CONTEXT, error);
        return { success: false, error: String(error) };
      }
    }
  );

  logger.debug(`${LOG_CONTEXT} Playbooks IPC handlers registered`);
}
