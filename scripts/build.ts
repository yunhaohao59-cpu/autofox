import { $ } from "bun";

async function main() {
  console.log("🦊 构建 autofox...\n");

  const cwd = import.meta.dir.replace("/scripts", "");
  const outfile = process.platform === "win32" ? "dist/autofox.exe" : "dist/autofox";

  // 1. Bundle frontend assets
  console.log("  [1/2] 打包前端资源...");
  await $`bun run scripts/bundle-assets.ts`.cwd(cwd);
  
  // 2. Compile
  console.log("  [2/2] 编译二进制...");
  await $`bun build --compile server/index.ts --outfile ${outfile}`.cwd(cwd);

  const stats = await Bun.file(outfile).stat();
  console.log(`\n✅ 构建完成: ${outfile} (${(stats.size / 1024 / 1024).toFixed(0)} MB)\n`);
  
  if (process.platform !== "win32") {
    console.log("💡 Windows 构建: 在 Windows 上运行 `bun run build`，输出 dist/autofox.exe\n");
  }
}

main();
