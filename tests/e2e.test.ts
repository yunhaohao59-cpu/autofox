import { describe, test, expect } from "bun:test";
import { ToolRegistry } from "../server/agent/tool-registry";
import { buildRegistry } from "../server/tools";
import { detectPlatform } from "../server/tools/platform";
import { deepMerge } from "../server/config/merge";
import { validateConfig, isSetupComplete } from "../server/config/validator";
import { DEFAULT_CONFIG } from "../server/config/types";
import type { AutofoxConfig } from "../server/config/types";

describe("E2E Integration", () => {
  test("full tool registry assembles with all layers", () => {
    const tools = buildRegistry();
    const registry = new ToolRegistry();
    registry.registerAll(tools);

    const defs = registry.listDefinitions();
    const names = defs.map((d) => d.function.name);

    expect(names).toContain("fs_read");
    expect(names).toContain("fs_write");
    expect(names).toContain("fs_list");
    expect(names).toContain("fs_exists");
    expect(names).toContain("shell");
    expect(names).toContain("http_get");
    expect(names).toContain("http_post");

    const platform = detectPlatform();
    if (platform === "linux") {
      expect(tools.length).toBeGreaterThanOrEqual(7);
    }
  });

  test("config round-trip: merge + validate + setup check", () => {
    const partial: Partial<AutofoxConfig> = {
      model: { provider: "openai", model: "gpt-4o", api_key: "sk-test" },
      vision: { enabled: true, strategy: "bridge", provider: "openai", model: "gpt-4o-mini", max_tokens: 1024, compress: true },
    };

    const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, partial as unknown as Record<string, unknown>) as unknown as AutofoxConfig;

    expect(merged.model.provider).toBe("openai");
    expect(merged.model.model).toBe("gpt-4o");
    expect(merged.vision.strategy).toBe("bridge");
    expect(merged.gateway.port).toBe(18900);

    const errors = validateConfig(merged);
    expect(errors.length).toBe(0);

    expect(isSetupComplete(merged)).toBe(true);
  });

  test("deepseek default config has no critical errors", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, api_key: "sk-test" },
    };
    const errors = validateConfig(cfg);
    expect(errors.length).toBe(0);
  });

  test("all tool definitions are valid for LLM consumption", () => {
    const tools = buildRegistry();
    for (const tool of tools) {
      expect(tool.definition.name).toBeString();
      expect(tool.definition.name.length).toBeGreaterThan(0);
      expect(tool.definition.description).toBeString();
      expect(tool.definition.parameters).toBeObject();

      if (tool.definition.name === "desktop_screenshot") {
        expect(tool.definition.parameters).toEqual({});
      }
    }
  });

  test("skill store + matcher integration paths exist", async () => {
    const { SkillMatcher } = await import("../server/skill/matcher");
    const { SkillExecutor } = await import("../server/skill/executor");
    expect(SkillMatcher).toBeDefined();
    expect(SkillExecutor).toBeDefined();
  });

  test("vision pipeline is importable", async () => {
    const { VisionPipeline } = await import("../server/vision/pipeline");
    const { SimpleEdgeDetector } = await import("../server/vision/edge-detector");
    expect(VisionPipeline).toBeDefined();
    expect(SimpleEdgeDetector).toBeDefined();
  });

  test("model providers are importable", async () => {
    const { createProvider } = await import("../server/model");
    expect(createProvider).toBeDefined();

    const deepseek = createProvider("deepseek", "sk-test");
    expect(deepseek.name).toBe("deepseek");

    const openai = createProvider("openai", "sk-test");
    expect(openai.name).toBe("openai");
  });

  test("memory modules are importable", async () => {
    const { SQLiteDB } = await import("../server/memory/sqlite");
    const { SessionManager } = await import("../server/memory/session");
    const { ContextCompressor } = await import("../server/memory/compressor");
    const { VectorStore } = await import("../server/memory/vector");
    expect(SQLiteDB).toBeDefined();
    expect(SessionManager).toBeDefined();
    expect(ContextCompressor).toBeDefined();
    expect(VectorStore).toBeDefined();
  });

  test("skill marketplace is importable", async () => {
    const { SkillMarketplace } = await import("../server/skill/marketplace");
    const { SkillRefiner } = await import("../server/skill/refiner");
    const { InstalledSkillsManager } = await import("../server/skill/installed");
    expect(SkillMarketplace).toBeDefined();
    expect(SkillRefiner).toBeDefined();
    expect(InstalledSkillsManager).toBeDefined();
  });
});
