import { readFile } from "node:fs/promises";
import { parse } from "smol-toml";
import { DEFAULT_CONFIG, CONFIG_PATH } from "./types";
import { deepMerge } from "./merge";
import type { AutofoxConfig } from "./types";

export async function loadConfig(): Promise<AutofoxConfig> {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    const parsed = parse(content);
    return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, parsed) as unknown as AutofoxConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function hasConfigFile(): boolean {
  try {
    const stat = Bun.file(CONFIG_PATH);
    return stat.size > 0;
  } catch {
    return false;
  }
}
