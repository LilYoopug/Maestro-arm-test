import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '../types';
import { gitService } from '../services/git';

/**
 * Return type for the useGitStatusPolling hook
 */
export interface UseGitStatusPollingReturn {
  /**
   * Map of session ID to git file change count.
   * Only sessions that are git repos will have entries.
   */
  gitFileCounts: Map<string, number>;
  /**
   * Manually trigger a refresh of git status for all sessions.
   * Useful when you know files have changed and want immediate feedback.
   */
  refreshGitStatus: () => Promise<void>;
}

/**
 * Configuration options for git status polling
 */
export interface UseGitStatusPollingOptions {
  /**
   * Polling interval in milliseconds.
   * Default: 30000 (30 seconds)
   */
  pollInterval?: number;
  /**
   * Whether to pause polling when document is hidden.
   * Default: true
   */
  pauseWhenHidden?: boolean;
}

const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds

/**
 * Hook that polls git status for all git repository sessions.
 *
 * Features:
 * - Only polls sessions marked as git repos
 * - Pauses polling when the app is in background (document hidden)
 * - Parallelizes git status calls for better performance
 * - Returns a map of session ID to changed file count
 *
 * Extracted from SessionList.tsx to reduce file size and improve maintainability.
 *
 * @param sessions - Array of all sessions to poll
 * @param options - Optional configuration for polling behavior
 * @returns Object containing gitFileCounts map and refreshGitStatus function
 */
export function useGitStatusPolling(
  sessions: Session[],
  options: UseGitStatusPollingOptions = {}
): UseGitStatusPollingReturn {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    pauseWhenHidden = true,
  } = options;

  const [gitFileCounts, setGitFileCounts] = useState<Map<string, number>>(new Map());

  // Use ref to track sessions to avoid stale closure issues in interval callback
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Poll git status for all Git sessions
  const pollGitStatus = useCallback(async () => {
    // Skip polling if document is hidden (app in background)
    if (pauseWhenHidden && document.hidden) return;

    const gitSessions = sessionsRef.current.filter(s => s.isGitRepo);
    if (gitSessions.length === 0) return;

    // Parallelize git status calls for better performance
    // Sequential calls with 10 sessions = 1-2s, parallel = 200-300ms
    const results = await Promise.all(
      gitSessions.map(async (session) => {
        try {
          const cwd = session.inputMode === 'terminal'
            ? (session.shellCwd || session.cwd)
            : session.cwd;
          const status = await gitService.getStatus(cwd);
          return [session.id, status.files.length] as const;
        } catch {
          return null;
        }
      })
    );

    const newCounts = new Map<string, number>();
    for (const result of results) {
      if (result) {
        newCounts.set(result[0], result[1]);
      }
    }

    setGitFileCounts(newCounts);
  }, [pauseWhenHidden]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      pollGitStatus();
      intervalId = setInterval(pollGitStatus, pollInterval);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Handle visibility changes - pause polling when app is in background
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Resume polling and immediately refresh when becoming visible
        startPolling();
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Start polling if document is visible (or if we don't pause when hidden)
    if (!pauseWhenHidden || !document.hidden) {
      startPolling();
    }

    return () => {
      stopPolling();
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [pollInterval, pauseWhenHidden, pollGitStatus]);

  return {
    gitFileCounts,
    refreshGitStatus: pollGitStatus,
  };
}
