import { mkdir } from "node:fs/promises";
import "./embed-data";
import { CONFIG_DIR, DB_PATH, SKILLS_DIR } from "./config/types";
import { loadConfig, hasConfigFile } from "./config/loader";
import { validateConfig, isSetupComplete } from "./config/validator";
import { startGateway, markFirstRun } from "./gateway/server";
import { SQLiteDB } from "./memory/sqlite";
import { SessionManager } from "./memory/session";
import { SkillStore } from "./skill/store";
import { SkillMarketplace } from "./skill/marketplace";
import { InstalledSkillsManager } from "./skill/installed";
import { AgentProfileManager } from "./skill/agent-profiles";
import { openAppWindow } from "./desktop";

async function ensureDirectories(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await mkdir(SKILLS_DIR, { recursive: true });
}

async function main() {
  await ensureDirectories();

  const isFirstRun = !hasConfigFile();
  if (isFirstRun) markFirstRun();

  const config = await loadConfig();
  const errors = validateConfig(config);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  [${e.path}] ${e.message}`);
  }

  const db = new SQLiteDB(DB_PATH);
  const sessions = new SessionManager(db.getDb());
  const skillStore = new SkillStore(db.getDb());
  const installedManager = new InstalledSkillsManager(db.getDb());
  const marketplace = new SkillMarketplace(config.skill.marketplace_url);
  const agentProfiles = new AgentProfileManager(db.getDb());

  const shutdown = () => { db.close(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const port = config.gateway.port;

  // 启动后自动打开桌面 App 窗口（仅桌面环境）
  if (process.env.DISPLAY || process.platform === "win32") {
    setTimeout(() => openAppWindow(port), 800);
  }

  startGateway(config, sessions, skillStore, marketplace, installedManager, db.getDb(), agentProfiles);
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
