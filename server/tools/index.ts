import type { Platform } from "../config/types";
import type { Tool } from "./platform";
import { getPlatformInfo } from "./platform";

import { linuxFileSystemAdapter } from "./l1-filesystem/linux";
import { macosFileSystemAdapter } from "./l1-filesystem/macos";
import { windowsFileSystemAdapter } from "./l1-filesystem/windows";
import { createFileSystemTools } from "./l1-filesystem/adapter";
import type { FileSystemAdapter } from "./l1-filesystem/adapter";

import { linuxShellAdapter } from "./l2-shell/linux";
import { macosShellAdapter } from "./l2-shell/macos";
import { windowsShellAdapter } from "./l2-shell/windows";
import { createShellTool } from "./l2-shell/linux";
import { createWindowsShellTool } from "./l2-shell/windows";
import type { ShellAdapter } from "./l2-shell/adapter";

import { createNetworkTools } from "./l3-network/adapter";

import { createLinuxDesktopTools } from "./l4-desktop/linux";

export type { FileSystemAdapter, ShellAdapter };

export function buildRegistry(platform?: Platform): Tool[] {
  const info = getPlatformInfo();
  const p = platform || info.platform;
  const { capabilities } = info;

  const tools: Tool[] = [];

  const fsAdapter = getFileSystemAdapter(p);
  tools.push(...createFileSystemTools(fsAdapter));

  const shellAdapter = getShellAdapter(p);
  const shellTool = p === "windows"
    ? createWindowsShellTool(shellAdapter)
    : createShellTool(shellAdapter);
  tools.push(shellTool);

  tools.push(...createNetworkTools());

  if (p === "linux" && capabilities.hasXdotool) {
    tools.push(...createLinuxDesktopTools());
  }

  return tools;
}

function getFileSystemAdapter(platform: Platform): FileSystemAdapter {
  switch (platform) {
    case "windows":
      return windowsFileSystemAdapter;
    case "macos":
      return macosFileSystemAdapter;
    default:
      return linuxFileSystemAdapter;
  }
}

function getShellAdapter(platform: Platform): ShellAdapter {
  switch (platform) {
    case "windows":
      return windowsShellAdapter;
    case "macos":
      return macosShellAdapter;
    default:
      return linuxShellAdapter;
  }
}
