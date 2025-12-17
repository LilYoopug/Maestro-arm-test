/**
 * OpenCode Output Parser
 *
 * Parses JSON output from OpenCode CLI.
 * OpenCode outputs JSONL with different message types:
 * - step_start: Beginning of an agent step
 * - text: Text content
 * - tool_use: Tool being used
 * - step_finish: End of step with result
 *
 * Key field mappings from OpenCode to normalized format:
 * - sessionID → sessionId
 * - part.text → text
 * - part.tokens → usage
 *
 * @see https://github.com/opencode-ai/opencode
 */

import type { ToolType, AgentError } from '../../shared/types';
import type { AgentOutputParser, ParsedEvent } from './agent-output-parser';
import { getErrorPatterns, matchErrorPattern } from './error-patterns';

/**
 * Raw message structure from OpenCode output
 * NOTE: Based on expected format - may need updates after integration testing
 */
interface OpenCodeRawMessage {
  type?: string;
  sessionID?: string;
  part?: {
    text?: string;
    tokens?: {
      input?: number;
      output?: number;
    };
  };
  tool?: {
    name?: string;
    state?: unknown;
  };
  result?: string;
  error?: string;
}

/**
 * OpenCode Output Parser Implementation
 *
 * Transforms OpenCode's JSON format into normalized ParsedEvents.
 *
 * NOTE: This implementation is based on expected/documented format.
 * May need updates when OpenCode CLI is fully integrated and tested.
 */
export class OpenCodeOutputParser implements AgentOutputParser {
  readonly agentId: ToolType = 'opencode';

  /**
   * Parse a single JSON line from OpenCode output
   *
   * OpenCode message types:
   * - { type: 'step_start', sessionID }
   * - { type: 'text', part: { text } }
   * - { type: 'tool_use', tool: { name, state } }
   * - { type: 'step_finish', result, part: { tokens } }
   */
  parseJsonLine(line: string): ParsedEvent | null {
    if (!line.trim()) {
      return null;
    }

    try {
      const msg: OpenCodeRawMessage = JSON.parse(line);
      return this.transformMessage(msg);
    } catch {
      // Not valid JSON - return as raw text event
      return {
        type: 'text',
        text: line,
        raw: line,
      };
    }
  }

  /**
   * Transform a parsed OpenCode message into a normalized ParsedEvent
   */
  private transformMessage(msg: OpenCodeRawMessage): ParsedEvent {
    // Handle step_start messages (session initialization)
    if (msg.type === 'step_start') {
      return {
        type: 'init',
        sessionId: msg.sessionID,
        raw: msg,
      };
    }

    // Handle text messages (streaming content)
    if (msg.type === 'text') {
      return {
        type: 'text',
        text: msg.part?.text || '',
        sessionId: msg.sessionID,
        isPartial: true,
        raw: msg,
      };
    }

    // Handle tool_use messages
    if (msg.type === 'tool_use') {
      return {
        type: 'tool_use',
        toolName: msg.tool?.name,
        toolState: msg.tool?.state,
        sessionId: msg.sessionID,
        raw: msg,
      };
    }

    // Handle step_finish messages (final result)
    if (msg.type === 'step_finish') {
      const event: ParsedEvent = {
        type: 'result',
        text: msg.result,
        sessionId: msg.sessionID,
        raw: msg,
      };

      // Extract usage stats if present
      const usage = this.extractUsageFromRaw(msg);
      if (usage) {
        event.usage = usage;
      }

      return event;
    }

    // Handle error messages
    if (msg.error) {
      return {
        type: 'error',
        text: msg.error,
        sessionId: msg.sessionID,
        raw: msg,
      };
    }

    // Handle messages with only session info or other types
    if (msg.sessionID) {
      return {
        type: 'system',
        sessionId: msg.sessionID,
        raw: msg,
      };
    }

    // Default: preserve as system event
    return {
      type: 'system',
      raw: msg,
    };
  }

  /**
   * Extract usage statistics from raw OpenCode message
   */
  private extractUsageFromRaw(msg: OpenCodeRawMessage): ParsedEvent['usage'] | null {
    if (!msg.part?.tokens) {
      return null;
    }

    return {
      inputTokens: msg.part.tokens.input || 0,
      outputTokens: msg.part.tokens.output || 0,
    };
  }

  /**
   * Check if an event is a final result message
   */
  isResultMessage(event: ParsedEvent): boolean {
    return event.type === 'result';
  }

  /**
   * Extract session ID from an event
   */
  extractSessionId(event: ParsedEvent): string | null {
    return event.sessionId || null;
  }

  /**
   * Extract usage statistics from an event
   */
  extractUsage(event: ParsedEvent): ParsedEvent['usage'] | null {
    return event.usage || null;
  }

  /**
   * Extract slash commands from an event
   * NOTE: OpenCode slash command support is unverified
   */
  extractSlashCommands(event: ParsedEvent): string[] | null {
    return event.slashCommands || null;
  }

  /**
   * Detect an error from a line of agent output
   */
  detectErrorFromLine(line: string): AgentError | null {
    // Skip empty lines
    if (!line.trim()) {
      return null;
    }

    // Try to parse as JSON first to check for error messages in structured output
    let textToCheck = line;
    try {
      const parsed = JSON.parse(line);
      // OpenCode uses an 'error' field for errors
      if (parsed.error) {
        textToCheck = parsed.error;
      } else if (parsed.type === 'error' && parsed.message) {
        textToCheck = parsed.message;
      }
    } catch {
      // Not JSON, check the raw line
    }

    // Match against error patterns
    const patterns = getErrorPatterns(this.agentId);
    const match = matchErrorPattern(patterns, textToCheck);

    if (match) {
      return {
        type: match.type,
        message: match.message,
        recoverable: match.recoverable,
        agentId: this.agentId,
        timestamp: Date.now(),
        raw: {
          errorLine: line,
        },
      };
    }

    return null;
  }

  /**
   * Detect an error from process exit information
   */
  detectErrorFromExit(
    exitCode: number,
    stderr: string,
    stdout: string
  ): AgentError | null {
    // Exit code 0 is success
    if (exitCode === 0) {
      return null;
    }

    // Check stderr and stdout for error patterns
    const combined = `${stderr}\n${stdout}`;
    const patterns = getErrorPatterns(this.agentId);
    const match = matchErrorPattern(patterns, combined);

    if (match) {
      return {
        type: match.type,
        message: match.message,
        recoverable: match.recoverable,
        agentId: this.agentId,
        timestamp: Date.now(),
        raw: {
          exitCode,
          stderr,
          stdout,
        },
      };
    }

    // Non-zero exit with no recognized pattern - treat as crash
    return {
      type: 'agent_crashed',
      message: `Agent exited with code ${exitCode}`,
      recoverable: true,
      agentId: this.agentId,
      timestamp: Date.now(),
      raw: {
        exitCode,
        stderr,
        stdout,
      },
    };
  }
}
