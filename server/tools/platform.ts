import type { Platform } from "../config/types";

let cachedPlatform: Platform | null = null;

export interface PlatformInfo {
  platform: Platform;
  os: string;
  arch: string;
  shell: string;
  homeDir: string;
  tmpDir: string;
  pathSep: string;
  newline: string;
  capabilities: PlatformCapabilities;
}

export interface PlatformCapabilities {
  hasChrome: boolean;
  hasEdge: boolean;
  hasXdotool: boolean;
  hasGnomeScreenshot: boolean;
  hasImport: boolean;
  hasPowershell: boolean;
}

export function detectPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;
  const os = process.platform;
  if (os === "win32") cachedPlatform = "windows";
  else if (os === "darwin") cachedPlatform = "macos";
  else cachedPlatform = "linux";
  return cachedPlatform;
}

export function getPlatform(): Platform {
  if (!cachedPlatform) return detectPlatform();
  return cachedPlatform;
}

export function detectShell(): string {
  const envShell = Bun.env.SHELL || "";
  if (envShell.endsWith("zsh")) return "zsh";
  if (envShell.endsWith("bash")) return "bash";
  if (envShell.endsWith("fish")) return "fish";
  if (process.platform === "win32") return "powershell";
  return "bash";
}

export function getPlatformInfo(): PlatformInfo {
  const platform = detectPlatform();
  const isWin = platform === "windows";

  return {
    platform,
    os: process.platform,
    arch: process.arch,
    shell: detectShell(),
    homeDir: Bun.env.HOME || Bun.env.USERPROFILE || "~",
    tmpDir: isWin ? (Bun.env.TEMP || "C:\\Temp") : "/tmp",
    pathSep: isWin ? "\\" : "/",
    newline: isWin ? "\r\n" : "\n",
    capabilities: {
      hasChrome: false,
      hasEdge: false,
      hasXdotool: !isWin && checkCommand("xdotool"),
      hasGnomeScreenshot: !isWin && checkCommand("gnome-screenshot"),
      hasImport: !isWin && (checkCommand("import") || checkCommand("magick")),
      hasPowershell: isWin || checkCommand("pwsh"),
    },
  };
}

function checkCommand(cmd: string): boolean {
  try {
    const proc = Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

export interface PlatformAdapter {
  readonly platform: Platform;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string; required?: boolean }>;
}

export interface Tool {
  readonly definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  detail?: string;
}

export function getPlatformHint(): string {
  const info = getPlatformInfo();
  switch (info.platform) {
    case "windows":
      return `You are running on Windows (${info.shell}). Use PowerShell commands. Paths use backslashes. Temp directory is ${info.tmpDir}.`;
    case "macos":
      return `You are running on macOS (${info.shell}). Use zsh/bash commands. Paths use forward slashes.`;
    default:
      return `You are running on Linux (${info.shell}). Use bash commands. Paths use forward slashes.`;
  }
}
