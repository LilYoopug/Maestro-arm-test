import { useCallback, useEffect, useMemo } from 'react';
import type { Session } from '../types';
import { loadFileTree, compareFileTrees, type FileTreeChanges } from '../utils/fileExplorer';
import { fuzzyMatch } from '../utils/search';
import { gitService } from '../services/git';

/**
 * Handle for RightPanel component to refresh history.
 */
export interface RightPanelHandle {
  refreshHistoryPanel: () => void;
}

/**
 * Dependencies for the useFileTreeManagement hook.
 */
export interface UseFileTreeManagementDeps {
  /** Current sessions array */
  sessions: Session[];
  /** Ref to sessions for accessing latest state without triggering effect re-runs */
  sessionsRef: React.MutableRefObject<Session[]>;
  /** Session state setter */
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Currently active session (derived from sessions) */
  activeSession: Session | null;
  /** File tree filter string */
  fileTreeFilter: string;
  /** Ref to RightPanel for refreshing history */
  rightPanelRef: React.RefObject<RightPanelHandle | null>;
}

/**
 * Return type for useFileTreeManagement hook.
 */
export interface UseFileTreeManagementReturn {
  /** Refresh file tree for a session and return detected changes */
  refreshFileTree: (sessionId: string) => Promise<FileTreeChanges | undefined>;
  /** Refresh both file tree and git state for a session */
  refreshGitFileState: (sessionId: string) => Promise<void>;
  /** Filtered file tree based on current filter */
  filteredFileTree: any[];
}

/**
 * Hook for file tree management operations.
 *
 * Handles:
 * - Loading file trees for sessions
 * - Refreshing file trees and detecting changes
 * - Refreshing git status (branches, tags, repo detection)
 * - Filtering file trees based on search query
 *
 * @param deps - Hook dependencies
 * @returns File tree management functions and computed values
 */
export function useFileTreeManagement(
  deps: UseFileTreeManagementDeps
): UseFileTreeManagementReturn {
  const {
    sessions,
    sessionsRef,
    setSessions,
    activeSessionId,
    activeSession,
    fileTreeFilter,
    rightPanelRef,
  } = deps;

  /**
   * Refresh file tree for a session and return the changes detected.
   * Uses sessionsRef to avoid dependency on sessions state (prevents timer reset on every session change).
   */
  const refreshFileTree = useCallback(async (sessionId: string): Promise<FileTreeChanges | undefined> => {
    // Use sessionsRef to avoid dependency on sessions state (prevents timer reset on every session change)
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session) return undefined;

    try {
      const oldTree = session.fileTree || [];
      const newTree = await loadFileTree(session.cwd);
      const changes = compareFileTrees(oldTree, newTree);

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, fileTree: newTree, fileTreeError: undefined } : s
      ));

      return changes;
    } catch (error) {
      console.error('File tree refresh error:', error);
      const errorMsg = (error as Error)?.message || 'Unknown error';
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? {
          ...s,
          fileTree: [],
          fileTreeError: `Cannot access directory: ${session.cwd}\n${errorMsg}`
        } : s
      ));
      return undefined;
    }
  }, [sessionsRef, setSessions]);

  /**
   * Refresh both file tree and git state for a session.
   * Loads file tree, checks git repo status, and fetches branches/tags if applicable.
   */
  const refreshGitFileState = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const cwd = session.inputMode === 'terminal' ? (session.shellCwd || session.cwd) : session.cwd;

    try {
      // Refresh file tree, git repo status, branches, and tags in parallel
      const [tree, isGitRepo] = await Promise.all([
        loadFileTree(cwd),
        gitService.isRepo(cwd)
      ]);

      let gitBranches: string[] | undefined;
      let gitTags: string[] | undefined;
      let gitRefsCacheTime: number | undefined;

      if (isGitRepo) {
        [gitBranches, gitTags] = await Promise.all([
          gitService.getBranches(cwd),
          gitService.getTags(cwd)
        ]);
        gitRefsCacheTime = Date.now();
      }

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? {
          ...s,
          fileTree: tree,
          fileTreeError: undefined,
          isGitRepo,
          gitBranches,
          gitTags,
          gitRefsCacheTime
        } : s
      ));

      // Also refresh history panel (reload from disk first to bypass electron-store cache)
      await window.maestro.history.reload();
      rightPanelRef.current?.refreshHistoryPanel();
    } catch (error) {
      console.error('Git/file state refresh error:', error);
      const errorMsg = (error as Error)?.message || 'Unknown error';
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? {
          ...s,
          fileTree: [],
          fileTreeError: `Cannot access directory: ${cwd}\n${errorMsg}`
        } : s
      ));
    }
  }, [sessions, setSessions, rightPanelRef]);

  /**
   * Load file tree when active session changes.
   * Only loads if file tree is empty.
   */
  useEffect(() => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    // Only load if file tree is empty
    if (!session.fileTree || session.fileTree.length === 0) {
      loadFileTree(session.cwd).then(tree => {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, fileTree: tree, fileTreeError: undefined } : s
        ));
      }).catch(error => {
        console.error('File tree error:', error);
        const errorMsg = error?.message || 'Unknown error';
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? {
            ...s,
            fileTree: [],
            fileTreeError: `Cannot access directory: ${session.cwd}\n${errorMsg}`
          } : s
        ));
      });
    }
  }, [activeSessionId, sessions, setSessions]);

  /**
   * Filter file tree based on search query.
   * Uses fuzzy matching on file/folder names.
   */
  const filteredFileTree = useMemo(() => {
    if (!activeSession || !fileTreeFilter || !activeSession.fileTree) {
      return activeSession?.fileTree || [];
    }

    const filterTree = (nodes: any[]): any[] => {
      return nodes.reduce((acc: any[], node) => {
        const matchesFilter = fuzzyMatch(node.name, fileTreeFilter);

        if (node.type === 'folder' && node.children) {
          const filteredChildren = filterTree(node.children);
          // Include folder if it matches or has matching children
          if (matchesFilter || filteredChildren.length > 0) {
            acc.push({
              ...node,
              children: filteredChildren
            });
          }
        } else if (node.type === 'file' && matchesFilter) {
          acc.push(node);
        }

        return acc;
      }, []);
    };

    return filterTree(activeSession.fileTree);
  }, [activeSession, fileTreeFilter]);

  return {
    refreshFileTree,
    refreshGitFileState,
    filteredFileTree,
  };
}
