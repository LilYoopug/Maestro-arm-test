import { ipcMain } from 'electron';
import Store from 'electron-store';
import { ProcessManager } from '../../process-manager';
import { AgentDetector } from '../../agent-detector';
import { logger } from '../../utils/logger';
import {
  withIpcErrorLogging,
  requireProcessManager,
  requireDependency,
  CreateHandlerOptions,
} from '../../utils/ipcHandler';

const LOG_CONTEXT = '[ProcessManager]';

/**
 * Helper to create handler options with consistent context
 */
const handlerOpts = (
  operation: string,
  extra?: Partial<CreateHandlerOptions>
): Pick<CreateHandlerOptions, 'context' | 'operation'> => ({
  context: LOG_CONTEXT,
  operation,
  ...extra,
});

/**
 * Interface for agent configuration store data
 */
interface AgentConfigsData {
  configs: Record<string, Record<string, any>>;
}

/**
 * Interface for Maestro settings store
 */
interface MaestroSettings {
  defaultShell: string;
  [key: string]: any;
}

/**
 * Dependencies required for process handler registration
 */
export interface ProcessHandlerDependencies {
  getProcessManager: () => ProcessManager | null;
  getAgentDetector: () => AgentDetector | null;
  agentConfigsStore: Store<AgentConfigsData>;
  settingsStore: Store<MaestroSettings>;
}

/**
 * Register all Process-related IPC handlers.
 *
 * These handlers manage process lifecycle operations:
 * - spawn: Start a new process for a session
 * - write: Send input to a process
 * - interrupt: Send SIGINT to a process
 * - kill: Terminate a process
 * - resize: Resize PTY dimensions
 * - getActiveProcesses: List all running processes
 * - runCommand: Execute a single command and capture output
 */
export function registerProcessHandlers(deps: ProcessHandlerDependencies): void {
  const { getProcessManager, getAgentDetector, agentConfigsStore, settingsStore } = deps;

  // Spawn a new process for a session
  // Supports agent-specific argument builders for batch mode, JSON output, resume, read-only mode, YOLO mode
  ipcMain.handle(
    'process:spawn',
    withIpcErrorLogging(handlerOpts('spawn'), async (config: {
      sessionId: string;
      toolType: string;
      cwd: string;
      command: string;
      args: string[];
      prompt?: string;
      shell?: string;
      images?: string[]; // Base64 data URLs for images
      // Agent-specific spawn options (used to build args via agent config)
      agentSessionId?: string;  // For session resume
      readOnlyMode?: boolean;   // For read-only/plan mode
      modelId?: string;         // For model selection
      yoloMode?: boolean;       // For YOLO/full-access mode (bypasses confirmations)
      // Per-session overrides (take precedence over agent-level config)
      sessionCustomPath?: string;     // Session-specific custom path
      sessionCustomArgs?: string;     // Session-specific custom args
      sessionCustomEnvVars?: Record<string, string>; // Session-specific env vars
    }) => {
      const processManager = requireProcessManager(getProcessManager);
      const agentDetector = requireDependency(getAgentDetector, 'Agent detector');

      // Get agent definition to access config options and argument builders
      const agent = await agentDetector.getAgent(config.toolType);
      logger.debug(`Spawn config received`, LOG_CONTEXT, {
        configToolType: config.toolType,
        configCommand: config.command,
        agentId: agent?.id,
        agentCommand: agent?.command,
        agentPath: agent?.path,
        hasAgentSessionId: !!config.agentSessionId,
        hasPrompt: !!config.prompt,
        promptLength: config.prompt?.length,
        promptValue: config.prompt,
      });
      let finalArgs = [...config.args];

      // ========================================================================
      // Build args from agent argument builders (for multi-agent support)
      // ========================================================================
      if (agent) {
        // For batch mode agents: prepend batch mode prefix (e.g., 'run' for OpenCode, 'exec' for Codex)
        // This must come BEFORE base args to form: opencode run --format json ...
        if (agent.batchModePrefix && config.prompt) {
          finalArgs = [...agent.batchModePrefix, ...finalArgs];
        }

        // Add batch mode args if the agent has them and we're in batch mode (have a prompt)
        // These are args that are only valid when using the batch subcommand (e.g., --skip-git-repo-check for Codex exec)
        if (agent.batchModeArgs && config.prompt) {
          finalArgs = [...finalArgs, ...agent.batchModeArgs];
        }

        // Add JSON output args if the agent supports it
        // For Claude: already in base args (--output-format stream-json)
        // For OpenCode: added here (--format json)
        if (agent.jsonOutputArgs && !finalArgs.some(arg => agent.jsonOutputArgs!.includes(arg))) {
          finalArgs = [...finalArgs, ...agent.jsonOutputArgs];
        }

        // Add working directory args for agents that support it
        // For Codex, this adds -C <dir> to set the working directory
        // IMPORTANT: Must come BEFORE resume subcommand (Codex: -C is not valid after 'resume')
        if (agent.workingDirArgs && config.cwd) {
          const workingDirArgArray = agent.workingDirArgs(config.cwd);
          finalArgs = [...finalArgs, ...workingDirArgArray];
        }

        // Add read-only mode args if readOnlyMode is true
        // For Codex: --sandbox read-only (must come before resume subcommand)
        if (config.readOnlyMode && agent.readOnlyArgs) {
          finalArgs = [...finalArgs, ...agent.readOnlyArgs];
        }

        // Add model selection args if modelId is provided
        if (config.modelId && agent.modelArgs) {
          const modelArgArray = agent.modelArgs(config.modelId);
          finalArgs = [...finalArgs, ...modelArgArray];
        }

        // Add YOLO mode args if yoloMode is true (bypasses all confirmations)
        // Note: For Claude Code, YOLO mode is always enabled via base args
        // For Codex, this adds --dangerously-bypass-approvals-and-sandbox
        if (config.yoloMode && agent.yoloModeArgs) {
          finalArgs = [...finalArgs, ...agent.yoloModeArgs];
        }

        // Add session resume args if agentSessionId is provided
        // IMPORTANT: Must come AFTER global options like -C, --sandbox (for Codex subcommand structure)
        if (config.agentSessionId && agent.resumeArgs) {
          const resumeArgArray = agent.resumeArgs(config.agentSessionId);
          finalArgs = [...finalArgs, ...resumeArgArray];
        }
      }

      // ========================================================================
      // Build additional args from agent configuration (legacy support)
      // ========================================================================
      if (agent && agent.configOptions) {
        const agentConfig = agentConfigsStore.get('configs', {})[config.toolType] || {};

        for (const option of agent.configOptions) {
          if (option.argBuilder) {
            // Get config value, fallback to default
            const value = agentConfig[option.key] !== undefined
              ? agentConfig[option.key]
              : option.default;

            // Build args from this config value
            const additionalArgs = option.argBuilder(value);
            finalArgs = [...finalArgs, ...additionalArgs];
          }
        }
      }

      // ========================================================================
      // Append custom CLI arguments from user configuration
      // Session-level overrides take precedence over agent-level config
      // ========================================================================
      const allConfigs = agentConfigsStore.get('configs', {});
      // Use session-level custom args if provided, otherwise fall back to agent-level
      const effectiveCustomArgs = config.sessionCustomArgs ?? allConfigs[config.toolType]?.customArgs;
      if (effectiveCustomArgs && typeof effectiveCustomArgs === 'string') {
        // Parse the custom args string - split on whitespace but respect quoted strings
        const customArgsArray = effectiveCustomArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
        // Remove surrounding quotes from quoted args
        const cleanedArgs = customArgsArray.map(arg => {
          if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            return arg.slice(1, -1);
          }
          return arg;
        });
        if (cleanedArgs.length > 0) {
          const source = config.sessionCustomArgs ? 'session' : 'agent';
          logger.debug(`Appending custom args for ${config.toolType} (${source}-level)`, LOG_CONTEXT, { customArgs: cleanedArgs });
          finalArgs = [...finalArgs, ...cleanedArgs];
        }
      }

      // ========================================================================
      // Get custom environment variables from user configuration
      // Session-level overrides take precedence over agent-level config
      // ========================================================================
      // Use session-level env vars if provided, otherwise fall back to agent-level
      const effectiveCustomEnvVars = config.sessionCustomEnvVars ?? allConfigs[config.toolType]?.customEnvVars as Record<string, string> | undefined;
      if (effectiveCustomEnvVars && Object.keys(effectiveCustomEnvVars).length > 0) {
        const source = config.sessionCustomEnvVars ? 'session' : 'agent';
        logger.debug(`Custom env vars configured for ${config.toolType} (${source}-level)`, LOG_CONTEXT, { keys: Object.keys(effectiveCustomEnvVars) });
      }

      // If no shell is specified and this is a terminal session, use the default shell from settings
      const shellToUse = config.shell || (config.toolType === 'terminal' ? settingsStore.get('defaultShell', 'zsh') : undefined);

      // Extract session ID from args for logging (supports both --resume and --session flags)
      const resumeArgIndex = finalArgs.indexOf('--resume');
      const sessionArgIndex = finalArgs.indexOf('--session');
      const agentSessionId = resumeArgIndex !== -1
        ? finalArgs[resumeArgIndex + 1]
        : sessionArgIndex !== -1
          ? finalArgs[sessionArgIndex + 1]
          : config.agentSessionId;

      logger.info(`Spawning process: ${config.command}`, LOG_CONTEXT, {
        sessionId: config.sessionId,
        toolType: config.toolType,
        cwd: config.cwd,
        command: config.command,
        fullCommand: `${config.command} ${finalArgs.join(' ')}`,
        args: finalArgs,
        requiresPty: agent?.requiresPty || false,
        shell: shellToUse,
        ...(agentSessionId && { agentSessionId }),
        ...(config.readOnlyMode && { readOnlyMode: true }),
        ...(config.yoloMode && { yoloMode: true }),
        ...(config.modelId && { modelId: config.modelId }),
        ...(config.prompt && { prompt: config.prompt.length > 500 ? config.prompt.substring(0, 500) + '...' : config.prompt })
      });

      // Get contextWindow from agent config (for agents like OpenCode/Codex that need user configuration)
      // Falls back to the agent's configOptions default (e.g., 200000 for Codex, 128000 for OpenCode)
      const agentConfig = agentConfigsStore.get('configs', {})[config.toolType] || {};
      const contextWindowOption = agent?.configOptions?.find(opt => opt.key === 'contextWindow');
      const contextWindowDefault = contextWindowOption?.default ?? 0;
      const contextWindow = typeof agentConfig.contextWindow === 'number' ? agentConfig.contextWindow : contextWindowDefault;

      const result = processManager.spawn({
        ...config,
        args: finalArgs,
        requiresPty: agent?.requiresPty,
        prompt: config.prompt,
        shell: shellToUse,
        contextWindow, // Pass configured context window to process manager
        customEnvVars: effectiveCustomEnvVars, // Pass custom env vars (session-level or agent-level)
      });

      logger.info(`Process spawned successfully`, LOG_CONTEXT, {
        sessionId: config.sessionId,
        pid: result.pid
      });
      return result;
    })
  );

  // Write data to a process
  ipcMain.handle(
    'process:write',
    withIpcErrorLogging(handlerOpts('write'), async (sessionId: string, data: string) => {
      const processManager = requireProcessManager(getProcessManager);
      logger.debug(`Writing to process: ${sessionId}`, LOG_CONTEXT, { sessionId, dataLength: data.length });
      return processManager.write(sessionId, data);
    })
  );

  // Send SIGINT to a process
  ipcMain.handle(
    'process:interrupt',
    withIpcErrorLogging(handlerOpts('interrupt'), async (sessionId: string) => {
      const processManager = requireProcessManager(getProcessManager);
      logger.info(`Interrupting process: ${sessionId}`, LOG_CONTEXT, { sessionId });
      return processManager.interrupt(sessionId);
    })
  );

  // Kill a process
  ipcMain.handle(
    'process:kill',
    withIpcErrorLogging(handlerOpts('kill'), async (sessionId: string) => {
      const processManager = requireProcessManager(getProcessManager);
      logger.info(`Killing process: ${sessionId}`, LOG_CONTEXT, { sessionId });
      return processManager.kill(sessionId);
    })
  );

  // Resize PTY dimensions
  ipcMain.handle(
    'process:resize',
    withIpcErrorLogging(handlerOpts('resize'), async (sessionId: string, cols: number, rows: number) => {
      const processManager = requireProcessManager(getProcessManager);
      return processManager.resize(sessionId, cols, rows);
    })
  );

  // Get all active processes managed by the ProcessManager
  ipcMain.handle(
    'process:getActiveProcesses',
    withIpcErrorLogging(handlerOpts('getActiveProcesses'), async () => {
      const processManager = requireProcessManager(getProcessManager);
      const processes = processManager.getAll();
      // Return serializable process info (exclude non-serializable PTY/child process objects)
      return processes.map(p => ({
        sessionId: p.sessionId,
        toolType: p.toolType,
        pid: p.pid,
        cwd: p.cwd,
        isTerminal: p.isTerminal,
        isBatchMode: p.isBatchMode || false,
        startTime: p.startTime,
      }));
    })
  );

  // Run a single command and capture only stdout/stderr (no PTY echo/prompts)
  ipcMain.handle(
    'process:runCommand',
    withIpcErrorLogging(handlerOpts('runCommand'), async (config: {
      sessionId: string;
      command: string;
      cwd: string;
      shell?: string;
    }) => {
      const processManager = requireProcessManager(getProcessManager);

      // Get the shell from settings if not provided
      // Shell name (e.g., 'zsh') will be resolved to full path in process-manager
      const shell = config.shell || settingsStore.get('defaultShell', 'zsh');

      logger.debug(`Running command: ${config.command}`, LOG_CONTEXT, {
        sessionId: config.sessionId,
        cwd: config.cwd,
        shell
      });

      return processManager.runCommand(
        config.sessionId,
        config.command,
        config.cwd,
        shell
      );
    })
  );
}
