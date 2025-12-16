/**
 * Shared history utilities for per-session storage
 *
 * This module provides common constants and types used by both the main process
 * (HistoryManager) and CLI (storage.ts) for per-session history storage.
 */

import type { HistoryEntry } from './types';

// Constants
export const HISTORY_VERSION = 1;
export const MAX_ENTRIES_PER_SESSION = 5000;
export const ORPHANED_SESSION_ID = '_orphaned';

/**
 * Per-session history file format
 */
export interface HistoryFileData {
  version: number;
  sessionId: string;
  projectPath: string;
  entries: HistoryEntry[];
}

/**
 * Migration marker file format
 */
export interface MigrationMarker {
  migratedAt: number;
  version: number;
  legacyEntryCount: number;
  sessionsMigrated: number;
}

/**
 * Pagination options for history queries
 */
export interface PaginationOptions {
  /** Number of entries to return (default: 100) */
  limit?: number;
  /** Number of entries to skip (default: 0) */
  offset?: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  entries: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION: Required<PaginationOptions> = {
  limit: 100,
  offset: 0,
};

/**
 * Sanitize a session ID for safe filesystem usage
 */
export function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Apply pagination to an array of entries
 */
export function paginateEntries<T>(
  entries: T[],
  options?: PaginationOptions
): PaginatedResult<T> {
  const limit = options?.limit ?? DEFAULT_PAGINATION.limit;
  const offset = options?.offset ?? DEFAULT_PAGINATION.offset;

  const paginatedEntries = entries.slice(offset, offset + limit);

  return {
    entries: paginatedEntries,
    total: entries.length,
    limit,
    offset,
    hasMore: offset + limit < entries.length,
  };
}

/**
 * Sort entries by timestamp (most recent first)
 */
export function sortEntriesByTimestamp(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}
