import { ipcMain } from 'electron';
import Store from 'electron-store';
import { ProcessManager } from '../../process-manager';
import { AgentDetector } from '../../agent-detector';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[ProcessManager]';

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
  ipcMain.handle('process:spawn', async (_, config: {
    sessionId: string;
    toolType: string;
    cwd: string;
    command: string;
    args: string[];
    prompt?: string;
    shell?: string;
    images?: string[]; // Base64 data URLs for images
  }) => {
    const processManager = getProcessManager();
    const agentDetector = getAgentDetector();

    if (!processManager) throw new Error('Process manager not initialized');
    if (!agentDetector) throw new Error('Agent detector not initialized');

    // Get agent definition to access config options
    const agent = await agentDetector.getAgent(config.toolType);
    let finalArgs = [...config.args];

    // Build additional args from agent configuration
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

    // If no shell is specified and this is a terminal session, use the default shell from settings
    const shellToUse = config.shell || (config.toolType === 'terminal' ? settingsStore.get('defaultShell', 'zsh') : undefined);

    // Extract Claude session ID from --resume arg if present
    const resumeArgIndex = finalArgs.indexOf('--resume');
    const claudeSessionId = resumeArgIndex !== -1 ? finalArgs[resumeArgIndex + 1] : undefined;

    logger.info(`Spawning process: ${config.command}`, LOG_CONTEXT, {
      sessionId: config.sessionId,
      toolType: config.toolType,
      cwd: config.cwd,
      command: config.command,
      args: finalArgs,
      requiresPty: agent?.requiresPty || false,
      shell: shellToUse,
      ...(claudeSessionId && { claudeSessionId }),
      ...(config.prompt && { prompt: config.prompt.length > 500 ? config.prompt.substring(0, 500) + '...' : config.prompt })
    });

    const result = processManager.spawn({
      ...config,
      args: finalArgs,
      requiresPty: agent?.requiresPty,
      prompt: config.prompt,
      shell: shellToUse
    });

    logger.info(`Process spawned successfully`, LOG_CONTEXT, {
      sessionId: config.sessionId,
      pid: result.pid
    });
    return result;
  });

  // Write data to a process
  ipcMain.handle('process:write', async (_, sessionId: string, data: string) => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');
    logger.debug(`Writing to process: ${sessionId}`, LOG_CONTEXT, { sessionId, dataLength: data.length });
    return processManager.write(sessionId, data);
  });

  // Send SIGINT to a process
  ipcMain.handle('process:interrupt', async (_, sessionId: string) => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');
    logger.info(`Interrupting process: ${sessionId}`, LOG_CONTEXT, { sessionId });
    return processManager.interrupt(sessionId);
  });

  // Kill a process
  ipcMain.handle('process:kill', async (_, sessionId: string) => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');
    logger.info(`Killing process: ${sessionId}`, LOG_CONTEXT, { sessionId });
    return processManager.kill(sessionId);
  });

  // Resize PTY dimensions
  ipcMain.handle('process:resize', async (_, sessionId: string, cols: number, rows: number) => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');
    return processManager.resize(sessionId, cols, rows);
  });

  // Get all active processes managed by the ProcessManager
  ipcMain.handle('process:getActiveProcesses', async () => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');
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
  });

  // Run a single command and capture only stdout/stderr (no PTY echo/prompts)
  ipcMain.handle('process:runCommand', async (_, config: {
    sessionId: string;
    command: string;
    cwd: string;
    shell?: string;
  }) => {
    const processManager = getProcessManager();
    if (!processManager) throw new Error('Process manager not initialized');

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
  });
}
