import type { Tool, ToolResult } from "../../tools/platform";
import type { ShellAdapter } from "./adapter";

export const windowsShellAdapter: ShellAdapter = {
  detectShell() {
    return "powershell";
  },

  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const { spawn } = require("node:child_process");
      const proc = spawn("powershell", ["-Command", command]);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

      proc.on("close", (exitCode: number) => {
        resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
      });
    });
  },
};

export function createWindowsShellTool(adapter: ShellAdapter): Tool {
  return {
    definition: {
      name: "shell",
      description: "Execute a command in PowerShell. Use standard Windows commands (dir, type, findstr, Get-ChildItem, etc.)",
      parameters: {
        command: { type: "string", description: "The PowerShell command to execute", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const result = await adapter.exec(args.command as string);
      if (result.exitCode === 0) {
        return { ok: true, summary: result.stdout || "(no output)" };
      }
      return { ok: false, summary: result.stderr || result.stdout || `Exit code: ${result.exitCode}` };
    },
  };
}
