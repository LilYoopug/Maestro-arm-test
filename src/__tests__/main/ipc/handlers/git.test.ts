/**
 * Tests for the Git IPC handlers
 *
 * These tests verify the Git-related IPC handlers that provide
 * git operations used across the application.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerGitHandlers } from '../../../../main/ipc/handlers/git';
import * as execFile from '../../../../main/utils/execFile';

// Mock electron's ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock the execFile module
vi.mock('../../../../main/utils/execFile', () => ({
  execFileNoThrow: vi.fn(),
}));

// Mock the logger
vi.mock('../../../../main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the cliDetection module
vi.mock('../../../../main/utils/cliDetection', () => ({
  resolveGhPath: vi.fn().mockResolvedValue('gh'),
  getCachedGhStatus: vi.fn().mockReturnValue(null),
  setCachedGhStatus: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    rmdir: vi.fn(),
  },
}));

// Mock chokidar
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('Git IPC handlers', () => {
  let handlers: Map<string, Function>;

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Capture all registered handlers
    handlers = new Map();
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers.set(channel, handler);
    });

    // Register handlers
    registerGitHandlers();
  });

  afterEach(() => {
    handlers.clear();
  });

  describe('registration', () => {
    it('should register all 24 git handlers', () => {
      const expectedChannels = [
        'git:status',
        'git:diff',
        'git:isRepo',
        'git:numstat',
        'git:branch',
        'git:remote',
        'git:branches',
        'git:tags',
        'git:info',
        'git:log',
        'git:commitCount',
        'git:show',
        'git:showFile',
        'git:worktreeInfo',
        'git:getRepoRoot',
        'git:worktreeSetup',
        'git:worktreeCheckout',
        'git:createPR',
        'git:checkGhCli',
        'git:getDefaultBranch',
        'git:listWorktrees',
        'git:scanWorktreeDirectory',
        'git:watchWorktreeDirectory',
        'git:unwatchWorktreeDirectory',
      ];

      expect(handlers.size).toBe(24);
      for (const channel of expectedChannels) {
        expect(handlers.has(channel)).toBe(true);
      }
    });
  });

  describe('git:status', () => {
    it('should return stdout from execFileNoThrow on success', async () => {
      vi.mocked(execFile.execFileNoThrow).mockResolvedValue({
        stdout: 'M  file.txt\nA  new.txt\n',
        stderr: '',
        exitCode: 0,
      });

      const handler = handlers.get('git:status');
      const result = await handler!({} as any, '/test/repo');

      expect(execFile.execFileNoThrow).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain'],
        '/test/repo'
      );
      expect(result).toEqual({
        stdout: 'M  file.txt\nA  new.txt\n',
        stderr: '',
      });
    });

    it('should return stderr when not a git repo', async () => {
      vi.mocked(execFile.execFileNoThrow).mockResolvedValue({
        stdout: '',
        stderr: 'fatal: not a git repository',
        exitCode: 128,
      });

      const handler = handlers.get('git:status');
      const result = await handler!({} as any, '/not/a/repo');

      expect(result).toEqual({
        stdout: '',
        stderr: 'fatal: not a git repository',
      });
    });

    it('should pass cwd parameter correctly', async () => {
      vi.mocked(execFile.execFileNoThrow).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const handler = handlers.get('git:status');
      await handler!({} as any, '/custom/path');

      expect(execFile.execFileNoThrow).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain'],
        '/custom/path'
      );
    });

    it('should return empty stdout for clean repository', async () => {
      vi.mocked(execFile.execFileNoThrow).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const handler = handlers.get('git:status');
      const result = await handler!({} as any, '/clean/repo');

      expect(result).toEqual({
        stdout: '',
        stderr: '',
      });
    });
  });
});
