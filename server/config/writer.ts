import { writeFile, mkdir } from "node:fs/promises";
import { stringify } from "smol-toml";
import { CONFIG_DIR, CONFIG_PATH } from "./types";
import { deepMerge } from "./merge";
import type { AutofoxConfig } from "./types";

export async function writeConfig(config: AutofoxConfig, partial?: Partial<AutofoxConfig>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });

  const final = partial
    ? deepMerge(config as unknown as Record<string, unknown>, partial as unknown as Record<string, unknown>) as unknown as AutofoxConfig
    : config;

  const toml = stringify(final as unknown as Record<string, unknown>);
  await writeFile(CONFIG_PATH, toml, "utf-8");
}
