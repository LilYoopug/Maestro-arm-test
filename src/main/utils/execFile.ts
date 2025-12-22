import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Maximum buffer size for command output (10MB)
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Safely execute a command without shell injection vulnerabilities
 * Uses execFile instead of exec to prevent shell interpretation
 *
 * On Windows, .cmd files (npm-installed CLIs) are handled by enabling shell mode,
 * since execFile cannot directly execute batch scripts without the shell.
 */
export async function execFileNoThrow(
  command: string,
  args: string[] = [],
  cwd?: string,
  env?: NodeJS.ProcessEnv
): Promise<ExecResult> {
  try {
    // On Windows, .cmd files need shell execution
    // This is safe because we're executing a specific file path, not user input
    const isWindows = process.platform === 'win32';
    const needsShell = isWindows && command.toLowerCase().endsWith('.cmd');

    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: EXEC_MAX_BUFFER,
      shell: needsShell,
    });

    return {
      stdout,
      stderr,
      exitCode: 0,
    };
  } catch (error: any) {
    // execFile throws on non-zero exit codes
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
    };
  }
}
