// 内嵌静态资源 — 构建时将所有前端文件 base64 编码嵌入到二进制
// 用脚本生成: bun run scripts/bundle-assets.ts

const EMBEDDED: Record<string, { type: string; b64: string }> = (globalThis as any).__AUTOFOX_ASSETS__ || {};

export function getEmbeddedAsset(path: string): { data: Buffer; contentType: string } | null {
  const key = path.replace(/^\//, "").replace(/\/$/, "/index.html");
  // 尝试精确匹配
  let asset = EMBEDDED[key];
  // 尝试 /app/ 前缀匹配
  if (!asset) asset = EMBEDDED["app/" + key.replace(/^app\//, "")];
  // favicon
  if (!asset && key.includes("favicon")) asset = EMBEDDED["图片/autofox.png"] || EMBEDDED["autofox.png"];
  if (!asset) return null;

  try {
    return {
      data: Buffer.from(asset.b64, "base64"),
      contentType: asset.type,
    };
  } catch {
    return null;
  }
}

export function getAllAssetKeys(): string[] {
  return Object.keys(EMBEDDED);
}

export function hasEmbeddedAssets(): boolean {
  return Object.keys(EMBEDDED).length > 0;
}
