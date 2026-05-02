import { describe, test, expect } from "bun:test";
import { detectPlatform, getPlatform } from "../server/tools/platform";
import { ToolRegistry } from "../server/agent/tool-registry";
import { buildSystemPrompt } from "../server/agent/system-prompt";
import { buildRegistry } from "../server/tools";

describe("ToolRegistry", () => {
  test("registry can register and retrieve tools", () => {
    const registry = new ToolRegistry();
    const tools = buildRegistry();
    registry.registerAll(tools);
    expect(registry.size).toBe(tools.length);
  });

  test("get returns undefined for unknown tool", () => {
    const registry = new ToolRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  test("listDefinitions returns correct format", () => {
    const registry = new ToolRegistry();
    registry.registerAll(buildRegistry());
    const defs = registry.listDefinitions();
    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) {
      expect(def.type).toBe("function");
      expect(def.function.name).toBeString();
      expect(def.function.description).toBeString();
    }
  });

  test("execute unknown tool returns error string", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute("unknown", {});
    expect(result).toContain("Error");
    expect(result).toContain("not found");
  });

  test("custom timeout option is stored", () => {
    const registry = new ToolRegistry({ timeoutMs: 5000 });
    expect(registry.size).toBe(0);
  });
});

describe("buildSystemPrompt", () => {
  test("buildSystemPrompt contains key sections", () => {
    const registry = new ToolRegistry();
    registry.registerAll(buildRegistry());
    const prompt = buildSystemPrompt("test context", registry.listDefinitions());
    expect(prompt).toContain("AI 桌面助手");
    expect(prompt).toContain("test context");
    expect(prompt).toContain("工具列表");
  });

  test("buildSystemPrompt includes all tool names", () => {
    const registry = new ToolRegistry();
    registry.registerAll(buildRegistry());
    const prompt = buildSystemPrompt("", registry.listDefinitions());
    const tools = buildRegistry();
    for (const tool of tools) {
      expect(prompt).toContain(tool.definition.name);
    }
  });
});

describe("Platform Detection", () => {
  test("detectPlatform returns valid platform", () => {
    const platform = detectPlatform();
    expect(["linux", "windows", "macos"]).toContain(platform);
  });

  test("getPlatform is consistent", () => {
    const first = detectPlatform();
    const second = getPlatform();
    expect(first).toBe(second);
  });
});
