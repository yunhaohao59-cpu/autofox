import { describe, test, expect } from "bun:test";
import {
  detectPlatform,
  getPlatform,
  getPlatformInfo,
  detectShell,
  getPlatformHint,
} from "../server/tools/platform";
import { buildRegistry } from "../server/tools";
import { ToolRegistry } from "../server/agent/tool-registry";

describe("Platform Detection", () => {
  test("detectPlatform returns valid platform", () => {
    const platform = detectPlatform();
    expect(["linux", "windows", "macos"]).toContain(platform);
  });

  test("getPlatform is consistent with detectPlatform", () => {
    const first = detectPlatform();
    const second = getPlatform();
    expect(first).toBe(second);
  });

  test("detectPlatform is cached", () => {
    const a = detectPlatform();
    const b = detectPlatform();
    const c = getPlatform();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("getPlatformInfo", () => {
  test("returns complete platform info", () => {
    const info = getPlatformInfo();
    expect(info.platform).toBeString();
    expect(info.os).toBeString();
    expect(info.arch).toBeString();
    expect(info.shell).toBeString();
    expect(info.homeDir).toBeString();
    expect(info.tmpDir).toBeString();
    expect(info.pathSep).toBeString();
    expect(info.newline).toBeString();
  });

  test("capabilities object exists with all keys", () => {
    const info = getPlatformInfo();
    expect(info.capabilities).toBeObject();
    expect("hasXdotool" in info.capabilities).toBe(true);
    expect("hasGnomeScreenshot" in info.capabilities).toBe(true);
    expect("hasImport" in info.capabilities).toBe(true);
    expect("hasPowershell" in info.capabilities).toBe(true);
    expect("hasChrome" in info.capabilities).toBe(true);
  });

  test("linux platform has forward slash", () => {
    if (process.platform === "linux") {
      const info = getPlatformInfo();
      expect(info.pathSep).toBe("/");
      expect(info.platform).toBe("linux");
    }
  });
});

describe("detectShell", () => {
  test("detectShell returns a string", () => {
    const shell = detectShell();
    expect(shell).toBeString();
    expect(shell.length).toBeGreaterThan(0);
  });
});

describe("getPlatformHint", () => {
  test("getPlatformHint contains platform info", () => {
    const hint = getPlatformHint();
    expect(hint).toContain("running on");
    expect(hint.length).toBeGreaterThan(20);
  });

  test("hint includes shell name on linux", () => {
    if (process.platform === "linux") {
      const hint = getPlatformHint();
      expect(hint).toContain("Linux");
    }
  });
});

describe("buildRegistry", () => {
  test("buildRegistry returns non-empty tool array", () => {
    const tools = buildRegistry();
    expect(tools.length).toBeGreaterThan(0);
  });

  test("buildRegistry includes fs tools", () => {
    const tools = buildRegistry();
    const names = tools.map((t) => t.definition.name);
    expect(names).toContain("fs_read");
    expect(names).toContain("fs_write");
    expect(names).toContain("fs_list");
    expect(names).toContain("fs_exists");
  });

  test("buildRegistry includes shell tool", () => {
    const tools = buildRegistry();
    const names = tools.map((t) => t.definition.name);
    expect(names).toContain("shell");
  });

  test("buildRegistry includes network tools", () => {
    const tools = buildRegistry();
    const names = tools.map((t) => t.definition.name);
    expect(names).toContain("http_get");
    expect(names).toContain("http_post");
  });

  test("buildRegistry accepts explicit platform", () => {
    const tools = buildRegistry("linux");
    const names = tools.map((t) => t.definition.name);
    expect(names).toContain("shell");
    expect(names).toContain("fs_read");
  });

  test("all tools have valid definitions", () => {
    const tools = buildRegistry();
    for (const tool of tools) {
      expect(tool.definition.name).toBeString();
      expect(tool.definition.name.length).toBeGreaterThan(0);
      expect(tool.definition.description).toBeString();
      expect(tool.definition.parameters).toBeObject();
      expect(typeof tool.execute).toBe("function");
    }
  });

  test("tools can be registered in ToolRegistry", () => {
    const registry = new ToolRegistry();
    const tools = buildRegistry();
    registry.registerAll(tools);
    const defs = registry.listDefinitions();
    expect(defs.length).toBe(tools.length);
  });

  test("shell tool definition is platform-aware on linux", () => {
    const tools = buildRegistry("linux");
    const shell = tools.find((t) => t.definition.name === "shell");
    expect(shell).toBeDefined();
    if (shell) {
      expect(shell.definition.description).toContain("Linux commands");
    }
  });

  test("shell tool definition is platform-aware on windows", () => {
    const tools = buildRegistry("windows");
    const shell = tools.find((t) => t.definition.name === "shell");
    expect(shell).toBeDefined();
    if (shell) {
      expect(shell.definition.description).toContain("PowerShell");
    }
  });

  test("buildRegistry includes at least 7 tools", () => {
    const tools = buildRegistry();
    expect(tools.length).toBeGreaterThanOrEqual(7);
  });
});
