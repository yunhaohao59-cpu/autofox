import { $ } from "bun";

async function main() {
  console.log("🦊 Starting autofox dev server...\n");

  const cwd = import.meta.dir.replace("/scripts", "");

  const proc = Bun.spawn(["bun", "run", "--watch", "server/index.ts"], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
  });

  process.on("SIGINT", () => {
    proc.kill();
    process.exit(0);
  });

  await proc.exited;
}

main();
