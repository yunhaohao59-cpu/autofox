import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { deepMerge } from "../server/config/merge";
import { validateConfig, isSetupComplete } from "../server/config/validator";
import { writeConfig } from "../server/config/writer";
import { loadConfig, hasConfigFile } from "../server/config/loader";
import { DEFAULT_CONFIG, CONFIG_PATH } from "../server/config/types";
import type { AutofoxConfig } from "../server/config/types";
import { mkdir, rm, readFile } from "node:fs/promises";

const TEST_DIR = "/tmp/autofox-test-config";

describe("deepMerge", () => {
  test("shallow merge overrides top-level keys", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 3 };
    const result = deepMerge(base as any, override as any);
    expect(result.a).toBe(1);
    expect(result.b).toBe(3);
  });

  test("deep merge preserves nested objects", () => {
    const base = { model: { provider: "deepseek", api_key: "", model: "deepseek-chat" } };
    const override = { model: { api_key: "sk-test", model: "deepseek-v3" } };
    const result = deepMerge(base as any, override as any);
    expect(result.model.provider).toBe("deepseek");
    expect(result.model.api_key).toBe("sk-test");
    expect(result.model.model).toBe("deepseek-v3");
  });

  test("deep merge handles vision partial override", () => {
    const base = {
      vision: {
        enabled: true,
        strategy: "bridge",
        provider: "openai",
        model: "gpt-4o-mini",
        max_tokens: 1024,
        compress: true,
      },
    };
    const override = { vision: { strategy: "native" } };
    const result = deepMerge(base as any, override as any);
    expect(result.vision.strategy).toBe("native");
    expect(result.vision.provider).toBe("openai");
    expect(result.vision.max_tokens).toBe(1024);
    expect(result.vision.compress).toBe(true);
  });

  test("deep merge does not mutate originals", () => {
    const base = { a: { x: 1 } };
    const override = { a: { y: 2 } };
    const result = deepMerge(base as any, override as any);
    expect(result.a.x).toBe(1);
    expect(result.a.y).toBe(2);
    expect((base as any).a.y).toBeUndefined();
    expect((override as any).a.x).toBeUndefined();
  });

  test("undefined values should not override objects", () => {
    const base = { vision: { strategy: "bridge" } };
    const override = { vision: undefined };
    const result = deepMerge(base as any, override as any);
    expect(result.vision.strategy).toBe("bridge");
  });
});

describe("validateConfig", () => {
  test("valid config has no errors", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, api_key: "sk-test" },
    };
    const errors = validateConfig(cfg);
    expect(errors.length).toBe(0);
  });

  test("missing model.provider reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, provider: "" },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "model.provider")).toBe(true);
  });

  test("invalid provider reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, provider: "invalid" },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "model.provider")).toBe(true);
  });

  test("invalid port below 1024 reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      gateway: { port: 80 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "gateway.port")).toBe(true);
  });

  test("invalid port above 65535 reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      gateway: { port: 99999 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "gateway.port")).toBe(true);
  });

  test("invalid vision strategy reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      vision: { ...DEFAULT_CONFIG.vision, enabled: true, strategy: "invalid" as any },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "vision.strategy")).toBe(true);
  });

  test("too low compaction threshold reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      memory: { ...DEFAULT_CONFIG.memory, compaction_threshold: 500 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "memory.compaction_threshold")).toBe(true);
  });

  test("invalid similarity threshold > 1 reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      skill: { ...DEFAULT_CONFIG.skill, similarity_threshold: 1.5 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "skill.similarity_threshold")).toBe(true);
  });

  test("negative similarity threshold reports error", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      skill: { ...DEFAULT_CONFIG.skill, similarity_threshold: -0.1 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "skill.similarity_threshold")).toBe(true);
  });

  test("valid similarity threshold passes", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      skill: { ...DEFAULT_CONFIG.skill, similarity_threshold: 0.8 },
    };
    const errors = validateConfig(cfg);
    expect(errors.some((e) => e.path === "skill.similarity_threshold")).toBe(false);
  });
});

describe("isSetupComplete", () => {
  test("empty api_key returns false", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, api_key: "" },
    };
    expect(isSetupComplete(cfg)).toBe(false);
  });

  test("filled api_key returns true", () => {
    const cfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, api_key: "sk-test" },
    };
    expect(isSetupComplete(cfg)).toBe(true);
  });
});

describe("writeConfig", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try { await rm(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  test("writeConfig creates a valid TOML file", async () => {
    const testPath = `${TEST_DIR}/config.toml`;
    const testCfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      model: { ...DEFAULT_CONFIG.model, api_key: "sk-test-123" },
    };

    const { writeFile } = await import("node:fs/promises");
    const { stringify } = await import("smol-toml");

    await mkdir(TEST_DIR, { recursive: true });
    const toml = stringify(testCfg as unknown as Record<string, unknown>);
    await writeFile(testPath, toml, "utf-8");

    const content = await readFile(testPath, "utf-8");
    expect(content).toContain("[gateway]");
    expect(content).toContain("[model]");
    expect(content).toContain("deepseek-chat");

    try { await rm(testPath, { force: true }); } catch {}
  });

  test("TOML round-trip preserves nested values", async () => {
    const testPath = `${TEST_DIR}/config.toml`;
    const testCfg: AutofoxConfig = {
      ...DEFAULT_CONFIG,
      gateway: { port: 19999 },
      model: { ...DEFAULT_CONFIG.model, api_key: "sk-roundtrip", provider: "openai", model: "gpt-4o" },
      vision: { ...DEFAULT_CONFIG.vision, strategy: "native" },
    };

    const { writeFile } = await import("node:fs/promises");
    const { stringify } = await import("smol-toml");
    const { parse } = await import("smol-toml");

    const toml = stringify(testCfg as unknown as Record<string, unknown>);
    await writeFile(testPath, toml, "utf-8");

    const content = await readFile(testPath, "utf-8");
    const parsed = parse(content);
    const merged = deepMerge(DEFAULT_CONFIG as any, parsed as any) as AutofoxConfig;

    expect(merged.gateway.port).toBe(19999);
    expect(merged.model.provider).toBe("openai");
    expect(merged.model.model).toBe("gpt-4o");
    expect(merged.vision.strategy).toBe("native");

    try { await rm(testPath, { force: true }); } catch {}
  });
});

describe("loadConfig", () => {
  test("loadConfig returns defaults when no file exists", async () => {
    const cfg = await loadConfig();
    expect(cfg.gateway.port).toBe(18900);
    expect(cfg.model.provider).toBe("deepseek");
    expect(cfg.vision.strategy).toBe("bridge");
  });
});
