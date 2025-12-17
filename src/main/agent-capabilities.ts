/**
 * Agent Capabilities System
 *
 * Defines what features each AI agent supports. This enables Maestro to:
 * - Show/hide UI features based on agent capabilities
 * - Use correct APIs and formats for each agent
 * - Handle agent differences in a consistent way
 *
 * When adding a new agent, define its capabilities here.
 */

/**
 * Capability flags that determine what features are available for each agent.
 */
export interface AgentCapabilities {
  /** Agent supports resuming existing sessions (e.g., --resume flag) */
  supportsResume: boolean;

  /** Agent supports read-only/plan mode (e.g., --permission-mode plan) */
  supportsReadOnlyMode: boolean;

  /** Agent outputs JSON-formatted responses (for parsing) */
  supportsJsonOutput: boolean;

  /** Agent provides a session ID for conversation continuity */
  supportsSessionId: boolean;

  /** Agent can accept image inputs (screenshots, diagrams, etc.) */
  supportsImageInput: boolean;

  /** Agent supports slash commands (e.g., /help, /compact) */
  supportsSlashCommands: boolean;

  /** Agent stores session history in a discoverable location */
  supportsSessionStorage: boolean;

  /** Agent provides cost/pricing information */
  supportsCostTracking: boolean;

  /** Agent provides token usage statistics */
  supportsUsageStats: boolean;

  /** Agent supports batch/headless mode (non-interactive) */
  supportsBatchMode: boolean;

  /** Agent streams responses in real-time */
  supportsStreaming: boolean;

  /** Agent provides distinct "result" messages when done */
  supportsResultMessages: boolean;
}

/**
 * Default capabilities - safe defaults for unknown agents.
 * All capabilities disabled by default (conservative approach).
 */
export const DEFAULT_CAPABILITIES: AgentCapabilities = {
  supportsResume: false,
  supportsReadOnlyMode: false,
  supportsJsonOutput: false,
  supportsSessionId: false,
  supportsImageInput: false,
  supportsSlashCommands: false,
  supportsSessionStorage: false,
  supportsCostTracking: false,
  supportsUsageStats: false,
  supportsBatchMode: false,
  supportsStreaming: false,
  supportsResultMessages: false,
};

/**
 * Capability definitions for each supported agent.
 *
 * NOTE: These are the current known capabilities. As agents evolve,
 * these may need to be updated. When in doubt, set capabilities to false
 * and mark them as "Unverified" or "PLACEHOLDER" until tested.
 *
 * Agents marked as PLACEHOLDER have not been integrated yet - their
 * capabilities are conservative defaults that should be updated when
 * the agent CLI becomes available and can be tested.
 */
export const AGENT_CAPABILITIES: Record<string, AgentCapabilities> = {
  /**
   * Claude Code - Full-featured AI coding assistant from Anthropic
   * https://github.com/anthropics/claude-code
   */
  'claude-code': {
    supportsResume: true,        // --resume flag
    supportsReadOnlyMode: true,  // --permission-mode plan
    supportsJsonOutput: true,    // --output-format stream-json
    supportsSessionId: true,     // session_id in JSON output
    supportsImageInput: true,    // Supports image attachments
    supportsSlashCommands: true, // /help, /compact, etc.
    supportsSessionStorage: true, // ~/.claude/projects/
    supportsCostTracking: true,  // Cost info in usage stats
    supportsUsageStats: true,    // Token counts in output
    supportsBatchMode: true,     // --print flag
    supportsStreaming: true,     // Stream JSON events
    supportsResultMessages: true, // "result" event type
  },

  /**
   * Terminal - Internal agent for shell sessions
   * Not a real AI agent, used for terminal process management
   */
  'terminal': {
    supportsResume: false,
    supportsReadOnlyMode: false,
    supportsJsonOutput: false,
    supportsSessionId: false,
    supportsImageInput: false,
    supportsSlashCommands: false,
    supportsSessionStorage: false,
    supportsCostTracking: false,
    supportsUsageStats: false,
    supportsBatchMode: false,
    supportsStreaming: true,  // PTY streams output
    supportsResultMessages: false,
  },

  /**
   * OpenAI Codex - OpenAI's code generation model
   *
   * PLACEHOLDER: All capabilities set to false until Codex CLI is available
   * and can be tested. Update this configuration when integrating the agent.
   */
  'openai-codex': {
    supportsResume: false,
    supportsReadOnlyMode: false,
    supportsJsonOutput: false,
    supportsSessionId: false,
    supportsImageInput: false,   // GPT-4 variants may support this
    supportsSlashCommands: false,
    supportsSessionStorage: false,
    supportsCostTracking: false,
    supportsUsageStats: false,
    supportsBatchMode: false,
    supportsStreaming: true,     // Most CLIs stream
    supportsResultMessages: false,
  },

  /**
   * Gemini CLI - Google's Gemini model CLI
   *
   * PLACEHOLDER: Most capabilities set to false until Gemini CLI is stable
   * and can be tested. Update this configuration when integrating the agent.
   */
  'gemini-cli': {
    supportsResume: false,
    supportsReadOnlyMode: false,
    supportsJsonOutput: false,
    supportsSessionId: false,
    supportsImageInput: true,    // Gemini supports multimodal
    supportsSlashCommands: false,
    supportsSessionStorage: false,
    supportsCostTracking: false,
    supportsUsageStats: false,
    supportsBatchMode: false,
    supportsStreaming: true,     // Likely streams
    supportsResultMessages: false,
  },

  /**
   * Qwen3 Coder - Alibaba's Qwen coding model
   *
   * PLACEHOLDER: Most capabilities set to false until Qwen3 Coder CLI is available
   * and can be tested. Update this configuration when integrating the agent.
   */
  'qwen3-coder': {
    supportsResume: false,
    supportsReadOnlyMode: false,
    supportsJsonOutput: false,
    supportsSessionId: false,
    supportsImageInput: false,
    supportsSlashCommands: false,
    supportsSessionStorage: false,
    supportsCostTracking: false, // Local model - no cost
    supportsUsageStats: false,
    supportsBatchMode: false,
    supportsStreaming: true,     // Likely streams
    supportsResultMessages: false,
  },

  /**
   * OpenCode - Open source coding assistant
   * https://github.com/opencode-ai/opencode
   *
   * NOTE: Some capabilities marked as false may be supported but are unverified.
   * Update this configuration after testing with the actual OpenCode CLI.
   */
  'opencode': {
    supportsResume: true,        // --session flag (sessionID in output)
    supportsReadOnlyMode: true,  // --agent plan (plan mode)
    supportsJsonOutput: true,    // --format json
    supportsSessionId: true,     // sessionID in JSON output
    supportsImageInput: false,   // Unverified - may be supported
    supportsSlashCommands: false, // Unverified - may be supported
    supportsSessionStorage: false, // Server-managed sessions
    supportsCostTracking: false, // May not apply to local/self-hosted
    supportsUsageStats: true,    // part.tokens in output
    supportsBatchMode: true,     // run subcommand
    supportsStreaming: true,     // Streams JSON events
    supportsResultMessages: true, // step_finish event type
  },
};

/**
 * Get capabilities for a specific agent.
 *
 * @param agentId - The agent identifier (e.g., 'claude-code', 'opencode')
 * @returns AgentCapabilities for the agent, or DEFAULT_CAPABILITIES if unknown
 */
export function getAgentCapabilities(agentId: string): AgentCapabilities {
  return AGENT_CAPABILITIES[agentId] || { ...DEFAULT_CAPABILITIES };
}

/**
 * Check if an agent has a specific capability.
 *
 * @param agentId - The agent identifier
 * @param capability - The capability key to check
 * @returns true if the agent supports the capability
 */
export function hasCapability(
  agentId: string,
  capability: keyof AgentCapabilities
): boolean {
  const capabilities = getAgentCapabilities(agentId);
  return capabilities[capability];
}
