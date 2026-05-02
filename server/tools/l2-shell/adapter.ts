export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellAdapter {
  exec(command: string): Promise<ShellResult>;
  detectShell(): string;
}
