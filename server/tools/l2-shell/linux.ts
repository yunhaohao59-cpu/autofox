import { spawn } from "node:child_process";
import type { Tool, ToolResult } from "../../tools/platform";

const SHELL_TIMEOUT_MS = 10_000;
const SHELL_OUTPUT_MAX_CHARS = 15_000;

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellAdapter {
  exec(command: string): Promise<ShellResult>;
  detectShell(): string;
}

export const linuxShellAdapter: ShellAdapter = {
  detectShell() {
    return "bash";
  },

  exec(command: string): Promise<ShellResult> {
    return executeWithShell("bash", command);
  },
};

function executeWithShell(shell: string, command: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    const proc = spawn(shell, ["-c", command], { timeout: SHELL_TIMEOUT_MS });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, SHELL_TIMEOUT_MS);

    proc.stdout.on("data", (data: Buffer) => {
      if (stdout.length < SHELL_OUTPUT_MAX_CHARS) {
        stdout += data.toString();
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      if (stderr.length < SHELL_OUTPUT_MAX_CHARS) {
        stderr += data.toString();
      }
    });

    proc.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut || signal === "SIGKILL") {
        const truncated = stdout.length >= SHELL_OUTPUT_MAX_CHARS;
        resolve({
          stdout: truncated ? stdout.slice(0, SHELL_OUTPUT_MAX_CHARS) + "\n[output truncated]" : stdout,
          stderr: `Command timed out after ${SHELL_TIMEOUT_MS}ms`,
          exitCode: 124,
        });
        return;
      }
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

export function createShellTool(adapter: ShellAdapter): Tool {
  const shell = adapter.detectShell();
  return {
    definition: {
      name: "shell",
      description: `Execute a shell command in ${shell}. Use standard Linux commands (ls, cat, grep, sed, find, etc.).`,
      parameters: {
        command: { type: "string", description: "The shell command to execute", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const cmd = args.command as string;
      if (!cmd || cmd.trim().length === 0) {
        return { ok: false, summary: "No command provided" };
      }

      const result = await adapter.exec(cmd);

      const output = [
        result.stdout ? result.stdout : "",
        result.stderr ? `\n[stderr]\n${result.stderr}` : "",
      ].filter(Boolean).join("");

      const truncated = output.length > SHELL_OUTPUT_MAX_CHARS
        ? output.slice(0, SHELL_OUTPUT_MAX_CHARS) + `\n... (${output.length - SHELL_OUTPUT_MAX_CHARS} more chars)`
        : output;

      if (result.exitCode === 0) {
        return { ok: true, summary: truncated || "(no output)", detail: `exit: 0` };
      }
      return { ok: false, summary: truncated || `Exit code: ${result.exitCode}`, detail: `exit: ${result.exitCode}` };
    },
  };
}
