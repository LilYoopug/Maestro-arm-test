import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { execFileNoThrow } from '../../utils/execFile';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[Git]';

/**
 * Register all Git-related IPC handlers.
 *
 * These handlers provide Git operations used across the application including:
 * - Basic operations: status, diff, branch, remote, tags
 * - Advanced queries: log, info, commitCount
 * - File operations: show, showFile
 * - Worktree management: worktreeInfo, worktreeSetup, worktreeCheckout
 * - GitHub CLI integration: checkGhCli, createPR, getDefaultBranch
 */
export function registerGitHandlers(): void {
  // Basic Git operations
  ipcMain.handle('git:status', async (_, cwd: string) => {
    const result = await execFileNoThrow('git', ['status', '--porcelain'], cwd);
    return { stdout: result.stdout, stderr: result.stderr };
  });

  ipcMain.handle('git:diff', async (_, cwd: string, file?: string) => {
    const args = file ? ['diff', file] : ['diff'];
    const result = await execFileNoThrow('git', args, cwd);
    return { stdout: result.stdout, stderr: result.stderr };
  });

  ipcMain.handle('git:isRepo', async (_, cwd: string) => {
    try {
      const result = await execFileNoThrow('git', ['rev-parse', '--is-inside-work-tree'], cwd);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle('git:numstat', async (_, cwd: string) => {
    const result = await execFileNoThrow('git', ['diff', '--numstat'], cwd);
    return { stdout: result.stdout, stderr: result.stderr };
  });

  ipcMain.handle('git:branch', async (_, cwd: string) => {
    const result = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    return { stdout: result.stdout.trim(), stderr: result.stderr };
  });

  ipcMain.handle('git:remote', async (_, cwd: string) => {
    const result = await execFileNoThrow('git', ['remote', 'get-url', 'origin'], cwd);
    return { stdout: result.stdout.trim(), stderr: result.stderr };
  });

  // Get all local and remote branches
  ipcMain.handle('git:branches', async (_, cwd: string) => {
    // Get all branches (local and remote) in a simple format
    // -a for all branches, --format to get clean names
    const result = await execFileNoThrow('git', ['branch', '-a', '--format=%(refname:short)'], cwd);
    if (result.exitCode !== 0) {
      return { branches: [], stderr: result.stderr };
    }
    const branches = result.stdout
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0)
      // Clean up remote branch names (origin/main -> main for remotes)
      .map(b => b.replace(/^origin\//, ''))
      // Remove duplicates (local and remote might have same name)
      .filter((b, i, arr) => arr.indexOf(b) === i)
      // Filter out HEAD pointer
      .filter(b => b !== 'HEAD');
    return { branches };
  });

  // Get all tags
  ipcMain.handle('git:tags', async (_, cwd: string) => {
    const result = await execFileNoThrow('git', ['tag', '--list'], cwd);
    if (result.exitCode !== 0) {
      return { tags: [], stderr: result.stderr };
    }
    const tags = result.stdout
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    return { tags };
  });

  ipcMain.handle('git:info', async (_, cwd: string) => {
    // Get comprehensive git info in a single call
    const [branchResult, remoteResult, statusResult, behindAheadResult] = await Promise.all([
      execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd),
      execFileNoThrow('git', ['remote', 'get-url', 'origin'], cwd),
      execFileNoThrow('git', ['status', '--porcelain'], cwd),
      execFileNoThrow('git', ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], cwd)
    ]);

    // Parse behind/ahead counts
    let behind = 0;
    let ahead = 0;
    if (behindAheadResult.exitCode === 0 && behindAheadResult.stdout.trim()) {
      const parts = behindAheadResult.stdout.trim().split(/\s+/);
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }

    // Count uncommitted changes
    const uncommittedChanges = statusResult.stdout.trim()
      ? statusResult.stdout.trim().split('\n').filter(l => l.length > 0).length
      : 0;

    return {
      branch: branchResult.stdout.trim(),
      remote: remoteResult.stdout.trim(),
      behind,
      ahead,
      uncommittedChanges
    };
  });

  ipcMain.handle('git:log', async (_, cwd: string, options?: { limit?: number; search?: string }) => {
    // Get git log with formatted output for parsing
    // Format: hash|author|date|refs|subject followed by shortstat
    // Using a unique separator to split commits
    const limit = options?.limit || 100;
    const args = [
      'log',
      `--max-count=${limit}`,
      '--pretty=format:COMMIT_START%H|%an|%ad|%D|%s',
      '--date=iso-strict',
      '--shortstat'
    ];

    // Add search filter if provided
    if (options?.search) {
      args.push('--all', `--grep=${options.search}`, '-i');
    }

    const result = await execFileNoThrow('git', args, cwd);

    if (result.exitCode !== 0) {
      return { entries: [], error: result.stderr };
    }

    // Split by COMMIT_START marker and parse each commit
    const commits = result.stdout.split('COMMIT_START').filter(c => c.trim());
    const entries = commits.map(commitBlock => {
      const lines = commitBlock.split('\n').filter(l => l.trim());
      const mainLine = lines[0];
      const [hash, author, date, refs, ...subjectParts] = mainLine.split('|');

      // Parse shortstat line (e.g., " 3 files changed, 10 insertions(+), 5 deletions(-)")
      let additions = 0;
      let deletions = 0;
      const statLine = lines.find(l => l.includes('changed'));
      if (statLine) {
        const addMatch = statLine.match(/(\d+) insertion/);
        const delMatch = statLine.match(/(\d+) deletion/);
        if (addMatch) additions = parseInt(addMatch[1], 10);
        if (delMatch) deletions = parseInt(delMatch[1], 10);
      }

      return {
        hash,
        shortHash: hash?.slice(0, 7),
        author,
        date,
        refs: refs ? refs.split(', ').filter(r => r.trim()) : [],
        subject: subjectParts.join('|'), // In case subject contains |
        additions,
        deletions,
      };
    });

    return { entries, error: null };
  });

  ipcMain.handle('git:commitCount', async (_, cwd: string) => {
    // Get total commit count using rev-list
    const result = await execFileNoThrow('git', ['rev-list', '--count', 'HEAD'], cwd);
    if (result.exitCode !== 0) {
      return { count: 0, error: result.stderr };
    }
    return { count: parseInt(result.stdout.trim(), 10) || 0, error: null };
  });

  ipcMain.handle('git:show', async (_, cwd: string, hash: string) => {
    // Get the full diff for a specific commit
    const result = await execFileNoThrow('git', ['show', '--stat', '--patch', hash], cwd);
    return { stdout: result.stdout, stderr: result.stderr };
  });

  // Read file content at a specific git ref (e.g., HEAD:path/to/file.png)
  // Returns base64 data URL for images, raw content for text files
  ipcMain.handle('git:showFile', async (_, cwd: string, ref: string, filePath: string) => {
    try {
      // Use git show to get file content at specific ref
      // We need to handle binary files differently
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'];
      const isImage = imageExtensions.includes(ext);

      if (isImage) {
        // For images, we need to get raw binary content
        // Use spawnSync to capture raw binary output
        const { spawnSync } = require('child_process');
        const result = spawnSync('git', ['show', `${ref}:${filePath}`], {
          cwd,
          encoding: 'buffer',
          maxBuffer: 50 * 1024 * 1024 // 50MB max
        });

        if (result.status !== 0) {
          return { error: result.stderr?.toString() || 'Failed to read file from git' };
        }

        const base64 = result.stdout.toString('base64');
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return { content: `data:${mimeType};base64,${base64}` };
      } else {
        // For text files, use regular exec
        const result = await execFileNoThrow('git', ['show', `${ref}:${filePath}`], cwd);
        if (result.exitCode !== 0) {
          return { error: result.stderr || 'Failed to read file from git' };
        }
        return { content: result.stdout };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Git worktree operations for Auto Run parallelization

  // Get information about a worktree at a given path
  ipcMain.handle('git:worktreeInfo', async (_, worktreePath: string) => {
    try {
      // Check if the path exists
      try {
        await fs.access(worktreePath);
      } catch {
        return { success: true, exists: false, isWorktree: false };
      }

      // Check if it's a git directory (could be main repo or worktree)
      const isInsideWorkTree = await execFileNoThrow('git', ['rev-parse', '--is-inside-work-tree'], worktreePath);
      if (isInsideWorkTree.exitCode !== 0) {
        return { success: true, exists: true, isWorktree: false };
      }

      // Get the git directory path
      const gitDirResult = await execFileNoThrow('git', ['rev-parse', '--git-dir'], worktreePath);
      if (gitDirResult.exitCode !== 0) {
        return { success: false, error: 'Failed to get git directory' };
      }
      const gitDir = gitDirResult.stdout.trim();

      // A worktree's .git is a file pointing to the main repo, not a directory
      // Check if this is a worktree by looking for .git file (not directory) or checking git-common-dir
      const gitCommonDirResult = await execFileNoThrow('git', ['rev-parse', '--git-common-dir'], worktreePath);
      const gitCommonDir = gitCommonDirResult.exitCode === 0 ? gitCommonDirResult.stdout.trim() : gitDir;

      // If git-dir and git-common-dir are different, this is a worktree
      const isWorktree = gitDir !== gitCommonDir;

      // Get the current branch
      const branchResult = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
      const currentBranch = branchResult.exitCode === 0 ? branchResult.stdout.trim() : undefined;

      // Get the repository root (of the main repository)
      const repoRootResult = await execFileNoThrow('git', ['rev-parse', '--show-toplevel'], worktreePath);
      let repoRoot: string | undefined;

      if (isWorktree && gitCommonDir) {
        // For worktrees, we need to find the main repo root from the common dir
        // The common dir points to the .git folder of the main repo
        // The main repo root is the parent of the .git folder
        const commonDirAbs = path.isAbsolute(gitCommonDir)
          ? gitCommonDir
          : path.resolve(worktreePath, gitCommonDir);
        repoRoot = path.dirname(commonDirAbs);
      } else if (repoRootResult.exitCode === 0) {
        repoRoot = repoRootResult.stdout.trim();
      }

      return {
        success: true,
        exists: true,
        isWorktree,
        currentBranch,
        repoRoot
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get the root directory of the git repository
  ipcMain.handle('git:getRepoRoot', async (_, cwd: string) => {
    try {
      const result = await execFileNoThrow('git', ['rev-parse', '--show-toplevel'], cwd);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Not a git repository' };
      }
      return { success: true, root: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create or reuse a worktree
  ipcMain.handle('git:worktreeSetup', async (_, mainRepoCwd: string, worktreePath: string, branchName: string) => {
    try {
      // Resolve paths to absolute for proper comparison
      const resolvedMainRepo = path.resolve(mainRepoCwd);
      const resolvedWorktree = path.resolve(worktreePath);

      // Check if worktree path is inside the main repo (nested worktree)
      // This can cause issues because git and Claude Code search upward for .git
      // and may resolve to the parent repo instead of the worktree
      if (resolvedWorktree.startsWith(resolvedMainRepo + path.sep)) {
        return {
          success: false,
          error: 'Worktree path cannot be inside the main repository. Please use a sibling directory (e.g., ../my-worktree) instead.'
        };
      }

      // First check if the worktree path already exists
      let pathExists = true;
      try {
        await fs.access(worktreePath);
      } catch {
        pathExists = false;
      }

      if (pathExists) {
        // Check if it's already a worktree of this repo
        const worktreeInfoResult = await execFileNoThrow('git', ['rev-parse', '--is-inside-work-tree'], worktreePath);
        if (worktreeInfoResult.exitCode !== 0) {
          return { success: false, error: 'Path exists but is not a git worktree or repository' };
        }

        // Get the common dir to check if it's the same repo
        const gitCommonDirResult = await execFileNoThrow('git', ['rev-parse', '--git-common-dir'], worktreePath);
        const mainGitDirResult = await execFileNoThrow('git', ['rev-parse', '--git-dir'], mainRepoCwd);

        if (gitCommonDirResult.exitCode === 0 && mainGitDirResult.exitCode === 0) {
          const worktreeCommonDir = path.resolve(worktreePath, gitCommonDirResult.stdout.trim());
          const mainGitDir = path.resolve(mainRepoCwd, mainGitDirResult.stdout.trim());

          // Normalize paths for comparison
          const normalizedWorktreeCommon = path.normalize(worktreeCommonDir);
          const normalizedMainGit = path.normalize(mainGitDir);

          if (normalizedWorktreeCommon !== normalizedMainGit) {
            return { success: false, error: 'Worktree path belongs to a different repository' };
          }
        }

        // Get current branch in the existing worktree
        const currentBranchResult = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
        const currentBranch = currentBranchResult.exitCode === 0 ? currentBranchResult.stdout.trim() : '';

        return {
          success: true,
          created: false,
          currentBranch,
          requestedBranch: branchName,
          branchMismatch: currentBranch !== branchName && branchName !== ''
        };
      }

      // Worktree doesn't exist, create it
      // First check if the branch exists
      const branchExistsResult = await execFileNoThrow('git', ['rev-parse', '--verify', branchName], mainRepoCwd);
      const branchExists = branchExistsResult.exitCode === 0;

      let createResult;
      if (branchExists) {
        // Branch exists, just add worktree pointing to it
        createResult = await execFileNoThrow('git', ['worktree', 'add', worktreePath, branchName], mainRepoCwd);
      } else {
        // Branch doesn't exist, create it with -b flag
        createResult = await execFileNoThrow('git', ['worktree', 'add', '-b', branchName, worktreePath], mainRepoCwd);
      }

      if (createResult.exitCode !== 0) {
        return { success: false, error: createResult.stderr || 'Failed to create worktree' };
      }

      return {
        success: true,
        created: true,
        currentBranch: branchName,
        requestedBranch: branchName,
        branchMismatch: false
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Checkout a branch in a worktree (with uncommitted changes check)
  ipcMain.handle('git:worktreeCheckout', async (_, worktreePath: string, branchName: string, createIfMissing: boolean) => {
    try {
      // Check for uncommitted changes
      const statusResult = await execFileNoThrow('git', ['status', '--porcelain'], worktreePath);
      if (statusResult.exitCode !== 0) {
        return { success: false, hasUncommittedChanges: false, error: 'Failed to check git status' };
      }

      const hasUncommittedChanges = statusResult.stdout.trim().length > 0;
      if (hasUncommittedChanges) {
        return {
          success: false,
          hasUncommittedChanges: true,
          error: 'Worktree has uncommitted changes. Please commit or stash them first.'
        };
      }

      // Check if branch exists
      const branchExistsResult = await execFileNoThrow('git', ['rev-parse', '--verify', branchName], worktreePath);
      const branchExists = branchExistsResult.exitCode === 0;

      let checkoutResult;
      if (branchExists) {
        checkoutResult = await execFileNoThrow('git', ['checkout', branchName], worktreePath);
      } else if (createIfMissing) {
        checkoutResult = await execFileNoThrow('git', ['checkout', '-b', branchName], worktreePath);
      } else {
        return { success: false, hasUncommittedChanges: false, error: `Branch '${branchName}' does not exist` };
      }

      if (checkoutResult.exitCode !== 0) {
        return { success: false, hasUncommittedChanges: false, error: checkoutResult.stderr || 'Checkout failed' };
      }

      return { success: true, hasUncommittedChanges: false };
    } catch (error) {
      return { success: false, hasUncommittedChanges: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create a PR from the worktree branch to a base branch
  // ghPath parameter allows specifying custom path to gh binary
  ipcMain.handle('git:createPR', async (_, worktreePath: string, baseBranch: string, title: string, body: string, ghPath?: string) => {
    try {
      // Use custom path if provided, otherwise fall back to 'gh' (expects it in PATH)
      const ghCommand = ghPath || 'gh';

      // First, push the current branch to origin
      const pushResult = await execFileNoThrow('git', ['push', '-u', 'origin', 'HEAD'], worktreePath);
      if (pushResult.exitCode !== 0) {
        return { success: false, error: `Failed to push branch: ${pushResult.stderr}` };
      }

      // Create the PR using gh CLI
      const prResult = await execFileNoThrow(ghCommand, [
        'pr', 'create',
        '--base', baseBranch,
        '--title', title,
        '--body', body
      ], worktreePath);

      if (prResult.exitCode !== 0) {
        // Check if gh CLI is not installed
        if (prResult.stderr.includes('command not found') || prResult.stderr.includes('not recognized')) {
          return { success: false, error: 'GitHub CLI (gh) is not installed. Please install it to create PRs.' };
        }
        return { success: false, error: prResult.stderr || 'Failed to create PR' };
      }

      // The PR URL is typically in stdout
      const prUrl = prResult.stdout.trim();
      return { success: true, prUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Check if GitHub CLI (gh) is installed and authenticated
  // ghPath parameter allows specifying custom path to gh binary (e.g., /opt/homebrew/bin/gh)
  ipcMain.handle('git:checkGhCli', async (_, ghPath?: string) => {
    try {
      // Use custom path if provided, otherwise fall back to 'gh' (expects it in PATH)
      const ghCommand = ghPath || 'gh';

      // Check if gh is installed by running gh --version
      const versionResult = await execFileNoThrow(ghCommand, ['--version']);
      if (versionResult.exitCode !== 0) {
        return { installed: false, authenticated: false };
      }

      // Check if gh is authenticated by running gh auth status
      const authResult = await execFileNoThrow(ghCommand, ['auth', 'status']);
      const authenticated = authResult.exitCode === 0;

      return { installed: true, authenticated };
    } catch {
      return { installed: false, authenticated: false };
    }
  });

  // Get the default branch name (main or master)
  ipcMain.handle('git:getDefaultBranch', async (_, cwd: string) => {
    try {
      // First try to get the default branch from remote
      const remoteResult = await execFileNoThrow('git', ['remote', 'show', 'origin'], cwd);
      if (remoteResult.exitCode === 0) {
        // Parse "HEAD branch: main" from the output
        const match = remoteResult.stdout.match(/HEAD branch:\s*(\S+)/);
        if (match) {
          return { success: true, branch: match[1] };
        }
      }

      // Fallback: check if main or master exists locally
      const mainResult = await execFileNoThrow('git', ['rev-parse', '--verify', 'main'], cwd);
      if (mainResult.exitCode === 0) {
        return { success: true, branch: 'main' };
      }

      const masterResult = await execFileNoThrow('git', ['rev-parse', '--verify', 'master'], cwd);
      if (masterResult.exitCode === 0) {
        return { success: true, branch: 'master' };
      }

      return { success: false, error: 'Could not determine default branch' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  logger.debug(`${LOG_CONTEXT} Git IPC handlers registered`);
}
