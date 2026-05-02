import type { ShellAdapter } from "./adapter";

export const macosShellAdapter: ShellAdapter = {
  detectShell() {
    return "zsh";
  },

  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const { spawn } = require("node:child_process");
      const proc = spawn("zsh", ["-c", command]);
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
