import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillMarketItem } from "../gateway/protocol";

export class SkillMarketplace {
  private cache: SkillMarketItem[] | null = null;
  private marketplaceUrl: string;

  constructor(marketplaceUrl: string) {
    this.marketplaceUrl = marketplaceUrl;
  }

  async list(): Promise<SkillMarketItem[]> {
    if (!this.cache) {
      try {
        const res = await fetch(this.marketplaceUrl);
        this.cache = await res.json() as SkillMarketItem[];
      } catch {
        try {
          const localPath = join(import.meta.dir, "..", "..", "skills-repo", "index.json");
          const localData = await readFile(localPath, "utf-8");
          this.cache = JSON.parse(localData) as SkillMarketItem[];
        } catch {
          this.cache = [];
        }
      }
    }
    return this.cache;
  }

  async install(skillId: string, skillsDir: string): Promise<boolean> {
    try {
      const localPath = join(import.meta.dir, "..", "..", "skills-repo", skillId);
      try {
        const { readFile, mkdir, writeFile } = await import("node:fs/promises");
        const tomlText = await readFile(`${localPath}/skill.toml`, "utf-8");
        const promptText = await readFile(`${localPath}/prompt.md`, "utf-8");
        const skillDir = `${skillsDir}/${skillId}`;
        await mkdir(skillDir, { recursive: true });
        await writeFile(`${skillDir}/skill.toml`, tomlText);
        await writeFile(`${skillDir}/prompt.md`, promptText);
        return true;
      } catch {
        // try remote
      }

      const baseUrl = this.marketplaceUrl.replace("/index.json", "");
      const [tomlRes, promptRes] = await Promise.all([
        fetch(`${baseUrl}/${skillId}/skill.toml`),
        fetch(`${baseUrl}/${skillId}/prompt.md`),
      ]);
      const tomlText = await tomlRes.text();
      const promptText = await promptRes.text();

      const skillDir = `${skillsDir}/${skillId}`;
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(skillDir, { recursive: true });
      await writeFile(`${skillDir}/skill.toml`, tomlText);
      await writeFile(`${skillDir}/prompt.md`, promptText);
      return true;
    } catch {
      return false;
    }
  }
}
