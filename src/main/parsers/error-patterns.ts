/**
 * Agent Error Patterns
 *
 * This module defines regex patterns for detecting errors in agent output.
 * Each agent has its own set of patterns matching its specific error messages.
 *
 * Usage:
 * ```typescript
 * import { getErrorPatterns, matchErrorPattern } from './error-patterns';
 *
 * const patterns = getErrorPatterns('claude-code');
 * const errorType = matchErrorPattern(patterns, line);
 * if (errorType) {
 *   // Handle error
 * }
 * ```
 */

import type { AgentErrorType, ToolType } from '../../shared/types';

/**
 * Error pattern definition with regex and user-friendly message
 */
export interface ErrorPattern {
  /** Regex to match against agent output */
  pattern: RegExp;
  /** User-friendly error message to display */
  message: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
}

/**
 * Error patterns organized by error type for an agent
 */
export type AgentErrorPatterns = {
  [K in AgentErrorType]?: ErrorPattern[];
};

// ============================================================================
// Claude Code Error Patterns
// ============================================================================

export const CLAUDE_ERROR_PATTERNS: AgentErrorPatterns = {
  auth_expired: [
    {
      pattern: /invalid api key/i,
      message: 'Your API key is invalid. Please re-authenticate.',
      recoverable: true,
    },
    {
      pattern: /authentication failed/i,
      message: 'Authentication failed. Please log in again.',
      recoverable: true,
    },
    {
      pattern: /please run.*claude login/i,
      message: 'Session expired. Please run "claude login" to re-authenticate.',
      recoverable: true,
    },
    {
      pattern: /unauthorized/i,
      message: 'Unauthorized access. Please check your credentials.',
      recoverable: true,
    },
    {
      pattern: /api key.*expired/i,
      message: 'Your API key has expired. Please renew your credentials.',
      recoverable: true,
    },
    {
      pattern: /not authenticated/i,
      message: 'Not authenticated. Please log in.',
      recoverable: true,
    },
  ],

  token_exhaustion: [
    {
      pattern: /context.*too long/i,
      message: 'The conversation has exceeded the context limit. Start a new session.',
      recoverable: true,
    },
    {
      pattern: /maximum.*tokens/i,
      message: 'Maximum token limit reached. Start a new session to continue.',
      recoverable: true,
    },
    {
      pattern: /context window/i,
      message: 'Context window exceeded. Please start a new session.',
      recoverable: true,
    },
    {
      pattern: /input.*too large/i,
      message: 'Input is too large for the context window.',
      recoverable: true,
    },
    {
      pattern: /token limit/i,
      message: 'Token limit reached. Consider starting a fresh conversation.',
      recoverable: true,
    },
  ],

  rate_limited: [
    {
      pattern: /rate limit/i,
      message: 'Rate limit exceeded. Please wait a moment before trying again.',
      recoverable: true,
    },
    {
      pattern: /too many requests/i,
      message: 'Too many requests. Please wait before sending more messages.',
      recoverable: true,
    },
    {
      pattern: /overloaded/i,
      message: 'The service is currently overloaded. Please try again later.',
      recoverable: true,
    },
    {
      pattern: /529/i,
      message: 'Service temporarily overloaded. Please wait and try again.',
      recoverable: true,
    },
    {
      pattern: /quota exceeded/i,
      message: 'Your API quota has been exceeded.',
      recoverable: false,
    },
    {
      pattern: /usage limit/i,
      message: 'Usage limit reached. Check your plan for available quota.',
      recoverable: false,
    },
  ],

  network_error: [
    {
      pattern: /connection.*failed/i,
      message: 'Connection failed. Check your internet connection.',
      recoverable: true,
    },
    {
      pattern: /timeout/i,
      message: 'Request timed out. Please try again.',
      recoverable: true,
    },
    {
      pattern: /ECONNREFUSED/i,
      message: 'Connection refused. The service may be unavailable.',
      recoverable: true,
    },
    {
      pattern: /ENOTFOUND/i,
      message: 'Network error. Check your internet connection.',
      recoverable: true,
    },
    {
      pattern: /network error/i,
      message: 'Network error occurred. Please check your connection.',
      recoverable: true,
    },
    {
      pattern: /socket hang up/i,
      message: 'Connection was interrupted. Please try again.',
      recoverable: true,
    },
  ],

  permission_denied: [
    {
      pattern: /permission denied/i,
      message: 'Permission denied. The agent cannot access the requested resource.',
      recoverable: false,
    },
    {
      pattern: /not allowed/i,
      message: 'This operation is not allowed.',
      recoverable: false,
    },
    {
      pattern: /access denied/i,
      message: 'Access denied to the requested resource.',
      recoverable: false,
    },
    {
      pattern: /forbidden/i,
      message: 'Forbidden. You may need additional permissions.',
      recoverable: false,
    },
  ],

  agent_crashed: [
    {
      pattern: /unexpected error/i,
      message: 'An unexpected error occurred in the agent.',
      recoverable: true,
    },
    {
      pattern: /internal error/i,
      message: 'Internal error. Please try again or restart the agent.',
      recoverable: true,
    },
    {
      pattern: /fatal error/i,
      message: 'Fatal error occurred. The agent needs to be restarted.',
      recoverable: true,
    },
  ],
};

// ============================================================================
// OpenCode Error Patterns
// ============================================================================

export const OPENCODE_ERROR_PATTERNS: AgentErrorPatterns = {
  auth_expired: [
    {
      pattern: /invalid.*key/i,
      message: 'Invalid API key. Please check your configuration.',
      recoverable: true,
    },
    {
      pattern: /authentication/i,
      message: 'Authentication required. Please configure your credentials.',
      recoverable: true,
    },
  ],

  token_exhaustion: [
    {
      pattern: /context.*exceeded/i,
      message: 'Context limit exceeded. Start a new session.',
      recoverable: true,
    },
    {
      pattern: /max.*length/i,
      message: 'Maximum input length exceeded.',
      recoverable: true,
    },
  ],

  rate_limited: [
    {
      pattern: /rate.*limit/i,
      message: 'Rate limit exceeded. Please wait.',
      recoverable: true,
    },
    {
      pattern: /too.*fast/i,
      message: 'Too many requests. Please slow down.',
      recoverable: true,
    },
  ],

  network_error: [
    {
      pattern: /connection/i,
      message: 'Connection error. Check your network.',
      recoverable: true,
    },
    {
      pattern: /timeout/i,
      message: 'Request timed out.',
      recoverable: true,
    },
  ],

  agent_crashed: [
    {
      pattern: /error/i,
      message: 'An error occurred.',
      recoverable: true,
    },
  ],
};

// ============================================================================
// Codex Error Patterns
// ============================================================================

export const CODEX_ERROR_PATTERNS: AgentErrorPatterns = {
  auth_expired: [
    {
      pattern: /invalid.*api.*key/i,
      message: 'Invalid API key. Please check your OpenAI credentials.',
      recoverable: true,
    },
    {
      pattern: /authentication.*failed/i,
      message: 'Authentication failed. Please verify your API key.',
      recoverable: true,
    },
    {
      pattern: /unauthorized/i,
      message: 'Unauthorized access. Please check your API key.',
      recoverable: true,
    },
    {
      pattern: /api.*key.*expired/i,
      message: 'Your API key has expired. Please renew your credentials.',
      recoverable: true,
    },
  ],

  token_exhaustion: [
    {
      pattern: /context.*length/i,
      message: 'Context length exceeded. Start a new session.',
      recoverable: true,
    },
    {
      pattern: /maximum.*tokens/i,
      message: 'Maximum token limit reached. Start a new session.',
      recoverable: true,
    },
    {
      pattern: /token.*limit/i,
      message: 'Token limit reached. Consider starting a fresh conversation.',
      recoverable: true,
    },
  ],

  rate_limited: [
    {
      pattern: /rate.*limit/i,
      message: 'Rate limit exceeded. Please wait before trying again.',
      recoverable: true,
    },
    {
      pattern: /too many requests/i,
      message: 'Too many requests. Please wait before sending more messages.',
      recoverable: true,
    },
    {
      pattern: /quota.*exceeded/i,
      message: 'Your API quota has been exceeded.',
      recoverable: false,
    },
    {
      pattern: /429/i,
      message: 'Rate limited. Please wait and try again.',
      recoverable: true,
    },
  ],

  network_error: [
    {
      pattern: /connection.*failed/i,
      message: 'Connection failed. Check your internet connection.',
      recoverable: true,
    },
    {
      pattern: /timeout/i,
      message: 'Request timed out. Please try again.',
      recoverable: true,
    },
    {
      pattern: /ECONNREFUSED/i,
      message: 'Connection refused. The service may be unavailable.',
      recoverable: true,
    },
    {
      pattern: /network.*error/i,
      message: 'Network error occurred. Please check your connection.',
      recoverable: true,
    },
  ],

  permission_denied: [
    {
      pattern: /permission denied/i,
      message: 'Permission denied. The agent cannot access the requested resource.',
      recoverable: false,
    },
    {
      pattern: /access denied/i,
      message: 'Access denied to the requested resource.',
      recoverable: false,
    },
  ],

  agent_crashed: [
    {
      pattern: /unexpected error/i,
      message: 'An unexpected error occurred in the agent.',
      recoverable: true,
    },
    {
      pattern: /internal error/i,
      message: 'Internal error. Please try again or restart the agent.',
      recoverable: true,
    },
    {
      pattern: /fatal/i,
      message: 'Fatal error occurred. The agent needs to be restarted.',
      recoverable: true,
    },
  ],
};

// ============================================================================
// Pattern Registry
// ============================================================================

const patternRegistry = new Map<ToolType, AgentErrorPatterns>([
  ['claude-code', CLAUDE_ERROR_PATTERNS],
  ['opencode', OPENCODE_ERROR_PATTERNS],
  ['codex', CODEX_ERROR_PATTERNS],
]);

/**
 * Get error patterns for an agent
 * @param agentId - The agent ID
 * @returns Error patterns or empty object if not found
 */
export function getErrorPatterns(agentId: ToolType | string): AgentErrorPatterns {
  return patternRegistry.get(agentId as ToolType) || {};
}

/**
 * Match a line against error patterns and return the error type
 * @param patterns - Error patterns to match against
 * @param line - The line to check
 * @returns Matched error info or null if no match
 */
export function matchErrorPattern(
  patterns: AgentErrorPatterns,
  line: string
): { type: AgentErrorType; message: string; recoverable: boolean } | null {
  // Check each error type's patterns
  const errorTypes: AgentErrorType[] = [
    'auth_expired',
    'token_exhaustion',
    'rate_limited',
    'network_error',
    'permission_denied',
    'agent_crashed',
  ];

  for (const errorType of errorTypes) {
    const typePatterns = patterns[errorType];
    if (!typePatterns) continue;

    for (const pattern of typePatterns) {
      if (pattern.pattern.test(line)) {
        return {
          type: errorType,
          message: pattern.message,
          recoverable: pattern.recoverable,
        };
      }
    }
  }

  return null;
}

/**
 * Register error patterns for an agent
 * @param agentId - The agent ID
 * @param patterns - Error patterns for the agent
 */
export function registerErrorPatterns(
  agentId: ToolType,
  patterns: AgentErrorPatterns
): void {
  patternRegistry.set(agentId, patterns);
}

/**
 * Clear the pattern registry (primarily for testing)
 */
export function clearPatternRegistry(): void {
  patternRegistry.clear();
}
