import { ipcMain, BrowserWindow, App } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[AutoRun]';

// State managed by this module
const autoRunWatchers = new Map<string, fsSync.FSWatcher>();
let autoRunWatchDebounceTimer: NodeJS.Timeout | null = null;

// Tree node interface for directory scanning
interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string; // Relative path from root folder
  children?: TreeNode[];
}

/**
 * Recursively scan directory for markdown files
 */
async function scanDirectory(dirPath: string, relativePath: string = ''): Promise<TreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  // Sort entries: folders first, then files, both alphabetically
  const sortedEntries = entries
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  for (const entry of sortedEntries) {
    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // Recursively scan subdirectory
      const children = await scanDirectory(path.join(dirPath, entry.name), entryRelativePath);
      // Only include folders that contain .md files (directly or in subfolders)
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          type: 'folder',
          path: entryRelativePath,
          children,
        });
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      // Add .md file (without extension in name, but keep in path)
      nodes.push({
        name: entry.name.slice(0, -3),
        type: 'file',
        path: entryRelativePath.slice(0, -3), // Remove .md from path too
      });
    }
  }

  return nodes;
}

/**
 * Flatten tree structure to flat list of paths
 */
function flattenTree(nodes: TreeNode[]): string[] {
  const files: string[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      files.push(node.path);
    } else if (node.children) {
      files.push(...flattenTree(node.children));
    }
  }
  return files;
}

/**
 * Validate path is within allowed folder (prevent directory traversal)
 */
function validatePathWithinFolder(filePath: string, folderPath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedFolder = path.resolve(folderPath);
  return resolvedPath.startsWith(resolvedFolder + path.sep) || resolvedPath === resolvedFolder;
}

/**
 * Register all Auto Run-related IPC handlers.
 *
 * These handlers provide Auto Run document operations:
 * - Document listing with tree structure
 * - Document read/write operations
 * - Image management (save, delete, list)
 * - Folder watching for external changes
 * - Folder deletion (wizard "start fresh" feature)
 */
export function registerAutorunHandlers(deps: {
  mainWindow: BrowserWindow | null;
  getMainWindow: () => BrowserWindow | null;
  app: App;
}): void {
  const { getMainWindow, app } = deps;

  // List markdown files in a directory for Auto Run (with recursive subfolder support)
  ipcMain.handle('autorun:listDocs', async (_event, folderPath: string) => {
    try {
      // Validate the folder path exists
      const folderStat = await fs.stat(folderPath);
      if (!folderStat.isDirectory()) {
        return { success: false, files: [], tree: [], error: 'Path is not a directory' };
      }

      const tree = await scanDirectory(folderPath);
      const files = flattenTree(tree);

      logger.info(`Listed ${files.length} markdown files in ${folderPath} (with subfolders)`, LOG_CONTEXT);
      return { success: true, files, tree };
    } catch (error) {
      logger.error('Error listing Auto Run docs', LOG_CONTEXT, error);
      return { success: false, files: [], tree: [], error: String(error) };
    }
  });

  // Read a markdown document for Auto Run (supports subdirectories)
  ipcMain.handle('autorun:readDoc', async (_event, folderPath: string, filename: string) => {
    try {
      // Reject obvious traversal attempts
      if (filename.includes('..')) {
        return { success: false, content: '', error: 'Invalid filename' };
      }

      // Ensure filename has .md extension
      const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

      const filePath = path.join(folderPath, fullFilename);

      // Validate the file is within the folder path (prevent traversal)
      if (!validatePathWithinFolder(filePath, folderPath)) {
        return { success: false, content: '', error: 'Invalid file path' };
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return { success: false, content: '', error: 'File not found' };
      }

      // Read the file
      const content = await fs.readFile(filePath, 'utf-8');

      logger.info(`Read Auto Run doc: ${fullFilename}`, LOG_CONTEXT);
      return { success: true, content };
    } catch (error) {
      logger.error('Error reading Auto Run doc', LOG_CONTEXT, error);
      return { success: false, content: '', error: String(error) };
    }
  });

  // Write a markdown document for Auto Run (supports subdirectories)
  ipcMain.handle('autorun:writeDoc', async (_event, folderPath: string, filename: string, content: string) => {
    try {
      // DEBUG: Log all write attempts to trace cross-session contamination
      logger.info(`[DEBUG] writeDoc called: folder=${folderPath}, file=${filename}, content.length=${content.length}, content.slice(0,50)="${content.slice(0, 50).replace(/\n/g, '\\n')}"`, LOG_CONTEXT);
      console.log(`[DEBUG writeDoc] folder=${folderPath}, file=${filename}, content.length=${content.length}`);

      // Reject obvious traversal attempts
      if (filename.includes('..')) {
        return { success: false, error: 'Invalid filename' };
      }

      // Ensure filename has .md extension
      const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

      const filePath = path.join(folderPath, fullFilename);

      // Validate the file is within the folder path (prevent traversal)
      if (!validatePathWithinFolder(filePath, folderPath)) {
        return { success: false, error: 'Invalid file path' };
      }

      // Ensure the parent directory exists (create if needed for subdirectories)
      const parentDir = path.dirname(filePath);
      try {
        await fs.access(parentDir);
      } catch {
        // Parent dir doesn't exist - create it if it's within folderPath
        const resolvedParent = path.resolve(parentDir);
        const resolvedFolder = path.resolve(folderPath);
        if (resolvedParent.startsWith(resolvedFolder)) {
          await fs.mkdir(parentDir, { recursive: true });
        } else {
          return { success: false, error: 'Invalid parent directory' };
        }
      }

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');

      logger.info(`Wrote Auto Run doc: ${fullFilename}`, LOG_CONTEXT);
      return { success: true };
    } catch (error) {
      logger.error('Error writing Auto Run doc', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Save image to Auto Run folder
  ipcMain.handle(
    'autorun:saveImage',
    async (_event, folderPath: string, docName: string, base64Data: string, extension: string) => {
      try {
        // Sanitize docName to prevent directory traversal
        const sanitizedDocName = path.basename(docName).replace(/\.md$/i, '');
        if (sanitizedDocName.includes('..') || sanitizedDocName.includes('/')) {
          return { success: false, error: 'Invalid document name' };
        }

        // Validate extension (only allow common image formats)
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        const sanitizedExtension = extension.toLowerCase().replace(/[^a-z]/g, '');
        if (!allowedExtensions.includes(sanitizedExtension)) {
          return { success: false, error: 'Invalid image extension' };
        }

        // Create images subdirectory if it doesn't exist
        const imagesDir = path.join(folderPath, 'images');
        try {
          await fs.mkdir(imagesDir, { recursive: true });
        } catch {
          // Directory might already exist, that's fine
        }

        // Generate filename: {docName}-{timestamp}.{ext}
        const timestamp = Date.now();
        const filename = `${sanitizedDocName}-${timestamp}.${sanitizedExtension}`;
        const filePath = path.join(imagesDir, filename);

        // Validate the file is within the folder path (prevent traversal)
        const resolvedPath = path.resolve(filePath);
        const resolvedFolder = path.resolve(folderPath);
        if (!resolvedPath.startsWith(resolvedFolder)) {
          return { success: false, error: 'Invalid file path' };
        }

        // Decode and write the image
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);

        // Return the relative path for markdown insertion
        const relativePath = `images/${filename}`;
        logger.info(`Saved Auto Run image: ${relativePath}`, LOG_CONTEXT);
        return { success: true, relativePath };
      } catch (error) {
        logger.error('Error saving Auto Run image', LOG_CONTEXT, error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Delete image from Auto Run folder
  ipcMain.handle('autorun:deleteImage', async (_event, folderPath: string, relativePath: string) => {
    try {
      // Sanitize relativePath to prevent directory traversal
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath) || !normalizedPath.startsWith('images/')) {
        return { success: false, error: 'Invalid image path' };
      }

      const filePath = path.join(folderPath, normalizedPath);

      // Validate the file is within the folder path (prevent traversal)
      const resolvedPath = path.resolve(filePath);
      const resolvedFolder = path.resolve(folderPath);
      if (!resolvedPath.startsWith(resolvedFolder)) {
        return { success: false, error: 'Invalid file path' };
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return { success: false, error: 'Image file not found' };
      }

      // Delete the file
      await fs.unlink(filePath);
      logger.info(`Deleted Auto Run image: ${relativePath}`, LOG_CONTEXT);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting Auto Run image', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // List images for a document (by prefix match)
  ipcMain.handle('autorun:listImages', async (_event, folderPath: string, docName: string) => {
    try {
      // Sanitize docName to prevent directory traversal
      const sanitizedDocName = path.basename(docName).replace(/\.md$/i, '');
      if (sanitizedDocName.includes('..') || sanitizedDocName.includes('/')) {
        return { success: false, error: 'Invalid document name' };
      }

      const imagesDir = path.join(folderPath, 'images');

      // Check if images directory exists
      try {
        await fs.access(imagesDir);
      } catch {
        // No images directory means no images
        return { success: true, images: [] };
      }

      // Read directory contents
      const files = await fs.readdir(imagesDir);

      // Filter files that start with the docName prefix
      const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
      const images = files
        .filter((file) => {
          // Check if filename starts with docName-
          if (!file.startsWith(`${sanitizedDocName}-`)) {
            return false;
          }
          // Check if it has a valid image extension
          const ext = file.split('.').pop()?.toLowerCase();
          return ext && imageExtensions.includes(ext);
        })
        .map((file) => ({
          filename: file,
          relativePath: `images/${file}`,
        }));

      return { success: true, images };
    } catch (error) {
      logger.error('Error listing Auto Run images', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Delete the entire Auto Run Docs folder (for wizard "start fresh" feature)
  ipcMain.handle('autorun:deleteFolder', async (_event, projectPath: string) => {
    try {
      // Validate input
      if (!projectPath || typeof projectPath !== 'string') {
        return { success: false, error: 'Invalid project path' };
      }

      // Construct the Auto Run Docs folder path
      const autoRunFolder = path.join(projectPath, 'Auto Run Docs');

      // Verify the folder exists
      try {
        const stat = await fs.stat(autoRunFolder);
        if (!stat.isDirectory()) {
          return { success: false, error: 'Auto Run Docs path is not a directory' };
        }
      } catch {
        // Folder doesn't exist, nothing to delete
        return { success: true };
      }

      // Safety check: ensure we're only deleting "Auto Run Docs" folder
      const folderName = path.basename(autoRunFolder);
      if (folderName !== 'Auto Run Docs') {
        return { success: false, error: 'Safety check failed: not an Auto Run Docs folder' };
      }

      // Delete the folder recursively
      await fs.rm(autoRunFolder, { recursive: true, force: true });

      logger.info(`Deleted Auto Run Docs folder: ${autoRunFolder}`, LOG_CONTEXT);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting Auto Run Docs folder', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Start watching an Auto Run folder for changes
  ipcMain.handle('autorun:watchFolder', async (_event, folderPath: string) => {
    try {
      // Stop any existing watcher for this folder
      if (autoRunWatchers.has(folderPath)) {
        autoRunWatchers.get(folderPath)?.close();
        autoRunWatchers.delete(folderPath);
      }

      // Create folder if it doesn't exist (agent will create files in it)
      try {
        await fs.stat(folderPath);
      } catch {
        // Folder doesn't exist, create it
        await fs.mkdir(folderPath, { recursive: true });
        logger.info(`Created Auto Run folder for watching: ${folderPath}`, LOG_CONTEXT);
      }

      // Validate folder exists
      const folderStat = await fs.stat(folderPath);
      if (!folderStat.isDirectory()) {
        return { success: false, error: 'Path is not a directory' };
      }

      // Start watching the folder recursively
      const watcher = fsSync.watch(folderPath, { recursive: true }, (eventType, filename) => {
        // Only care about .md files
        if (!filename || !filename.toLowerCase().endsWith('.md')) {
          return;
        }

        // Debounce to avoid flooding with events during rapid saves
        if (autoRunWatchDebounceTimer) {
          clearTimeout(autoRunWatchDebounceTimer);
        }

        autoRunWatchDebounceTimer = setTimeout(() => {
          autoRunWatchDebounceTimer = null;
          // Send event to renderer
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            // Remove .md extension from filename to match autorun conventions
            const filenameWithoutExt = filename.replace(/\.md$/i, '');
            mainWindow.webContents.send('autorun:fileChanged', {
              folderPath,
              filename: filenameWithoutExt,
              eventType, // 'rename' or 'change'
            });
            logger.info(`Auto Run file changed: ${filename} (${eventType})`, LOG_CONTEXT);
          }
        }, 300); // 300ms debounce
      });

      autoRunWatchers.set(folderPath, watcher);

      watcher.on('error', (error) => {
        logger.error(`Auto Run watcher error for ${folderPath}`, LOG_CONTEXT, error);
      });

      logger.info(`Started watching Auto Run folder: ${folderPath}`, LOG_CONTEXT);
      return { success: true };
    } catch (error) {
      logger.error('Error starting Auto Run folder watcher', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Stop watching an Auto Run folder
  ipcMain.handle('autorun:unwatchFolder', async (_event, folderPath: string) => {
    try {
      if (autoRunWatchers.has(folderPath)) {
        autoRunWatchers.get(folderPath)?.close();
        autoRunWatchers.delete(folderPath);
        logger.info(`Stopped watching Auto Run folder: ${folderPath}`, LOG_CONTEXT);
      }
      return { success: true };
    } catch (error) {
      logger.error('Error stopping Auto Run folder watcher', LOG_CONTEXT, error);
      return { success: false, error: String(error) };
    }
  });

  // Clean up all watchers on app quit
  app.on('before-quit', () => {
    for (const [folderPath, watcher] of autoRunWatchers) {
      watcher.close();
      logger.info(`Cleaned up Auto Run watcher for: ${folderPath}`, LOG_CONTEXT);
    }
    autoRunWatchers.clear();
  });

  logger.debug(`${LOG_CONTEXT} Auto Run IPC handlers registered`);
}

/**
 * Get the current number of active watchers (for testing/debugging)
 */
export function getAutoRunWatcherCount(): number {
  return autoRunWatchers.size;
}
