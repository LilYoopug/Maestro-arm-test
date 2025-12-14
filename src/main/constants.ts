/**
 * Main process constants
 *
 * Centralized constants used across the main process for Claude session parsing,
 * API pricing, and demo mode detection.
 */

import path from 'path';
import os from 'os';

/**
 * Demo mode flag - enables isolated data directory for fresh demos
 * Activated via --demo CLI flag or MAESTRO_DEMO_DIR environment variable
 */
export const DEMO_MODE = process.argv.includes('--demo') || !!process.env.MAESTRO_DEMO_DIR;

/**
 * Demo data directory path (only meaningful when DEMO_MODE is true)
 */
export const DEMO_DATA_PATH = process.env.MAESTRO_DEMO_DIR || path.join(os.tmpdir(), 'maestro-demo');

/**
 * Limits for parsing Claude Code session JSONL files
 * These limits optimize scanning by avoiding full file reads for metadata extraction
 */
export const CLAUDE_SESSION_PARSE_LIMITS = {
  /** Max lines to scan from start of file to find first user message */
  FIRST_MESSAGE_SCAN_LINES: 20,
  /** Max lines to scan from end of file to find last timestamp */
  LAST_TIMESTAMP_SCAN_LINES: 10,
  /** Max lines to scan for oldest timestamp in stats calculation */
  OLDEST_TIMESTAMP_SCAN_LINES: 5,
  /** Batch size for processing session files (allows UI updates between batches) */
  STATS_BATCH_SIZE: 20,
  /** Max characters for first message preview */
  FIRST_MESSAGE_PREVIEW_LENGTH: 200,
} as const;

/**
 * Claude API pricing (per million tokens) - Sonnet 4 pricing
 * Used for cost estimation in session statistics
 */
export const CLAUDE_PRICING = {
  INPUT_PER_MILLION: 3,
  OUTPUT_PER_MILLION: 15,
  CACHE_READ_PER_MILLION: 0.30,
  CACHE_CREATION_PER_MILLION: 3.75,
} as const;

/**
 * Type for CLAUDE_SESSION_PARSE_LIMITS object
 */
export type ClaudeSessionParseLimits = typeof CLAUDE_SESSION_PARSE_LIMITS;

/**
 * Type for CLAUDE_PRICING object
 */
export type ClaudePricing = typeof CLAUDE_PRICING;
