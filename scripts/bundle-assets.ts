// 将前端资源打包为 TypeScript 内嵌字符串
// 用法: bun run scripts/bundle-assets.ts
// 输出: server/embed-data.ts (被 embed-assets.ts 引用)

import { readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";

const ROOT = join(import.meta.dir, "..");
const ASSET_DIRS = ["app", "图片"];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = Array.from(new Bun.Glob("**/*").scanSync({ cwd: dir, absolute: false }));
  for (const e of entries) {
    const full = join(dir, e);
    if ((await Bun.file(full).stat()).isFile()) files.push(e);
  }
  return files;
}

async function main() {
  const assets: Record<string, { type: string; b64: string }> = {};

  for (const dir of ASSET_DIRS) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    const files = await walk(fullDir);
    for (const f of files) {
      const data = await readFile(join(fullDir, f));
      const b64 = data.toString("base64");
      const ext = extname(f) || ".html";
      const type = MIME[ext] || "application/octet-stream";
      const key = dir + "/" + f.replace(/\\/g, "/");
      assets[key] = { type, b64 };
    }
  }

  // favicon shortcut
  if (assets["图片/autofox.png"]) {
    assets["favicon.ico"] = { ...assets["图片/autofox.png"], type: "image/x-icon" };
  }

  const out = `// 自动生成 — 由 scripts/bundle-assets.ts 生成
// 不要手动编辑

(globalThis as any).__AUTOFOX_ASSETS__ = ${JSON.stringify(assets, null, 2)};
`;

  await writeFile(join(ROOT, "server", "embed-data.ts"), out);
  console.log(`✅ 已打包 ${Object.keys(assets).length} 个资源文件`);
  console.log(`   输出: server/embed-data.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
