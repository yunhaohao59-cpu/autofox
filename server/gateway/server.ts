import type { Database } from "bun:sqlite";
import type { AutofoxConfig, AgentProfile } from "../config/types";
import { CHINESE_PROVIDERS, THEMES, PROVIDER_NAMES } from "../config/types";
import { writeConfig } from "../config/writer";
import { validateConfig } from "../config/validator";
import type { SessionManager } from "../memory/session";
import type { SkillStore } from "../skill/store";
import type { SkillMarketplace } from "../skill/marketplace";
import type { InstalledSkillsManager } from "../skill/installed";
import type { AgentProfileManager } from "../skill/agent-profiles";
import { AgentMessageStore } from "../memory/agent-messages";
import { AgentRuntime, type AgentEvents } from "../agent/runtime";
import { ToolRegistry } from "../agent/tool-registry";
import { buildRegistry } from "../tools";
import { detectPlatform, getPlatformInfo } from "../tools/platform";
import { getEmbeddedAsset, hasEmbeddedAssets } from "../embed-assets";
import { createDesktopShortcut, enableAutoStart, getDesktopInfo } from "../desktop";
import type { Frame, ChatRequest } from "./protocol";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type { Frame };

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json",
  png: "image/png",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

let isFirstRun = false;

export function markFirstRun() { isFirstRun = true; }

export function startGateway(
  config: AutofoxConfig,
  sessions: SessionManager,
  _skillStore: SkillStore,
  marketplace: SkillMarketplace,
  installedManager: InstalledSkillsManager,
  db: Database,
  agentProfiles: AgentProfileManager,
) {
  const port = config.gateway.port;
  const platform = detectPlatform();
  const info = getPlatformInfo();
  const projectRoot = join(import.meta.dir, "..", "..");

  const toolRegistry = new ToolRegistry();
  const allTools = buildRegistry(platform);
  toolRegistry.registerAll(allTools);
  const msgStore = new AgentMessageStore(db);

  function serveEmbedded(pathname: string): Response | null {
    // index.html
    if (pathname === "/" || pathname.endsWith("/")) {
      const asset = getEmbeddedAsset("app/index.html");
      if (asset) return new Response(asset.data, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      return null;
    }
    // favicon
    if (pathname.includes("favicon")) {
      const asset = getEmbeddedAsset("图片/autofox.png");
      if (asset) return new Response(asset.data, { headers: { "Content-Type": "image/png" } });
      return null;
    }
    // app/ assets
    const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const asset = getEmbeddedAsset(cleanPath);
    if (asset) return new Response(asset.data, { headers: { "Content-Type": asset.contentType } });
    return null;
  }

  // Fallback disk reader (dev mode)
  async function serveDisk(pathname: string): Promise<Response | null> {
    if (pathname === "/" || pathname.endsWith("/")) pathname = "/app/index.html";
    if (!pathname.startsWith("/app/") && !pathname.startsWith("/图片/") && !pathname.includes("favicon")) return null;
    try {
      let filePath = join(projectRoot, pathname);
      if (pathname.includes("favicon")) filePath = join(projectRoot, "图片", "autofox.png");
      const content = await readFile(filePath);
      const ext = pathname.split(".").pop() || "html";
      const ct = MIME[ext] || "application/octet-stream";
      return new Response(content, { headers: { "Content-Type": ct } });
    } catch { return null; }
  }

  Bun.serve({
    port,
    websocket: {
      message(ws, message) {
        try {
          const frame = JSON.parse(message as string) as Frame;
          handleWS(ws, frame, config, sessions, toolRegistry, db, agentProfiles, msgStore);
        } catch (e) {
          ws.send(JSON.stringify({ type: "event", event: "error", data: { message: String(e) } }));
        }
      },
    },

    async fetch(req, server) {
      const url = new URL(req.url);

      // Static (embedded first, disk fallback)
      if (hasEmbeddedAssets()) {
        const res = serveEmbedded(url.pathname);
        if (res) return res;
      }
      const diskRes = await serveDisk(url.pathname);
      if (diskRes) return diskRes;

      if (url.pathname === "/chat/stream") {
        if (server.upgrade(req)) return;
        return Response.json({ error: "WebSocket upgrade failed" }, { status: 500 });
      }

      const j = (data: unknown) => Response.json(data);

      if (url.pathname === "/chat") return handleChatRest(req, config, sessions, toolRegistry, db, agentProfiles, msgStore);
      if (url.pathname === "/sessions") return handleSessionsRest(req, sessions);
      if (url.pathname.startsWith("/sessions/")) return handleSessionById(req, sessions, url);
      if (url.pathname === "/config") return handleConfigRest(req, config);
      if (url.pathname === "/providers") return j(PROVIDER_NAMES);
      if (url.pathname === "/themes") return j(THEMES.map(t => ({ id: t.id, name: t.name, nameZh: t.nameZh })));
      if (url.pathname === "/themes/full") return j(THEMES);
      if (url.pathname === "/agents") return handleAgentsRest(req, agentProfiles);
      if (url.pathname.startsWith("/agents/") && url.pathname.endsWith("/onboarding")) return handleAgentOnboarding(req, agentProfiles, url);
      if (url.pathname.startsWith("/agents/") && url.pathname.endsWith("/messages")) return handleAgentMessages(req, msgStore, url);
      if (url.pathname.startsWith("/agents/")) return handleAgentById(req, agentProfiles, url);
      if (url.pathname === "/desktop/info") return j(getDesktopInfo());
      if (url.pathname === "/desktop/shortcut") {
        const ok = createDesktopShortcut();
        return j({ ok });
      }
      if (url.pathname === "/desktop/autostart") {
        const body = await req.json() as { enabled: boolean };
        const ok = enableAutoStart(body.enabled);
        return j({ ok });
      }
      if (url.pathname === "/setup/complete") {
        const body = await req.json() as { desktop_shortcut?: boolean; auto_start?: boolean };
        if (body.desktop_shortcut) createDesktopShortcut();
        if (body.auto_start) enableAutoStart(true);
        return j({ ok: true });
      }
      if (url.pathname === "/skills/marketplace") return handleMarketplaceRest(marketplace, url);
      if (url.pathname === "/skills/marketplace/install") return handleMarketplaceInstall(req, marketplace);
      if (url.pathname === "/skills/installed") return handleInstalledSkills(installedManager);
      if (url.pathname === "/skills/installed/uninstall" && req.method === "POST") {
        const body = await req.json() as { skillId: string };
        return j({ ok: installedManager.remove(body.skillId) });
      }
      if (url.pathname === "/setup/status") return j({
        has_api_key: config.model.api_key.length > 0,
        provider: config.model.provider,
        model: config.model.model,
        is_first_run: isFirstRun,
        desktop: getDesktopInfo(),
      });

      return j({ ok: true, name: "autofox", version: "0.2.0" });
    },
  });

  console.log(`\n🦊 autofox v0.2.0 → http://localhost:${port}`);
  console.log(`   Platform: ${platform} (${info.shell}, ${info.arch})`);
  console.log(`   Model: ${config.model.provider}/${config.model.model}`);
  console.log(`   Tools: ${allTools.length} | Agents: ${agentProfiles.list().length} | Sessions: ${sessions.list().length}\n`);
}

function send(ws: { send: (data: string) => void }, type: string, data: Record<string, unknown>) {
  ws.send(JSON.stringify({ type: "event", event: type, data }));
}

async function handleWS(
  ws: { send: (data: string) => void },
  frame: Frame,
  config: AutofoxConfig,
  sessions: SessionManager,
  toolRegistry: ToolRegistry,
  db: Database,
  agentProfiles: AgentProfileManager,
  msgStore: AgentMessageStore,
) {
  if (frame.type === "req" && frame.method === "chat.send") {
    const params = frame.params as unknown as ChatRequest & { agent_id?: string };
    const agentProfile = params.agent_id ? (agentProfiles.get(params.agent_id) ?? undefined) : undefined;

    const events: AgentEvents = {
      onToolCall(name, args) { send(ws, "tool_call", { name, args }); },
      onToolResult(name, ok, summary) { send(ws, "tool_result", { name, ok, summary }); },
      onVision(strategy, description) { send(ws, "vision", { strategy, description }); },
      onCompaction(originalCount, compactedTo) { send(ws, "compaction", { originalCount, compactedTo }); },
      onSkillMatch(skill) { send(ws, "skill_match", { name: skill.name, score: skill.score }); },
      onSkillRefined(name) { send(ws, "skill_refined", { name }); },
    };

    const runtime = new AgentRuntime(config, events, db, agentProfile);
    const rt = new ToolRegistry();
    rt.registerAll(buildRegistry(detectPlatform()));
    runtime.registerTools(rt);

    if (!params.session_id) {
      params.session_id = sessions.create(params.message.slice(0, 50));
      send(ws, "session_created", { session_id: params.session_id });
    }

    try {
      for await (const chunk of runtime.run(params.message)) { send(ws, "text_delta", { text: chunk }); }
      send(ws, "done", { finish_reason: "stop", session_id: params.session_id });
    } catch (e) {
      send(ws, "done", { finish_reason: "error", error: String(e), session_id: params.session_id });
    }
  }
}

async function handleChatRest(
  req: Request, config: AutofoxConfig, sessions: SessionManager,
  toolRegistry: ToolRegistry, db: Database, agentProfiles: AgentProfileManager, msgStore: AgentMessageStore,
): Promise<Response> {
  const body = await req.json() as ChatRequest & { agent_id?: string };
  if (!body.session_id) body.session_id = sessions.create(body.message.slice(0, 50));
  const agentProfile = body.agent_id ? (agentProfiles.get(body.agent_id) ?? undefined) : undefined;
  let content = "";
  const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: { ok: boolean; summary: string } }> = [];

  const events: AgentEvents = {
    onToolCall(name, args) { toolCalls.push({ name, args }); },
    onToolResult(name, ok, summary) { const tc = toolCalls.find(t => t.name === name && !t.result); if (tc) tc.result = { ok, summary }; },
  };

  const runtime = new AgentRuntime(config, events, db, agentProfile);
  const rt = new ToolRegistry();
  rt.registerAll(buildRegistry(detectPlatform()));
  runtime.registerTools(rt);

  for await (const chunk of runtime.run(body.message)) { content += chunk; }
  return Response.json({ session_id: body.session_id, content, finish_reason: "stop", tool_calls: toolCalls });
}

async function handleSessionsRest(req: Request, sessions: SessionManager): Promise<Response> {
  if (req.method === "POST") {
    const body = await req.json() as { name?: string };
    return Response.json({ id: sessions.create(body.name) });
  }
  return Response.json(sessions.list());
}

async function handleSessionById(req: Request, sessions: SessionManager, url: URL): Promise<Response> {
  const id = url.pathname.split("/").pop()!;
  if (req.method === "DELETE") { sessions.delete(id); return Response.json({ ok: true }); }
  if (req.method === "PUT" && url.pathname.endsWith("/rename")) {
    const body = await req.json() as { name: string };
    sessions.rename(id, body.name);
    return Response.json({ ok: true });
  }
  return Response.json(sessions.getChats(id));
}

async function handleAgentsRest(req: Request, profiles: AgentProfileManager): Promise<Response> {
  if (req.method === "POST") {
    const body = await req.json() as Partial<AgentProfile>;
    return Response.json(profiles.create(body));
  }
  return Response.json(profiles.list());
}

async function handleAgentById(req: Request, profiles: AgentProfileManager, url: URL): Promise<Response> {
  const id = url.pathname.split("/").pop()!;
  if (req.method === "PUT") { profiles.update(id, await req.json() as any); return Response.json({ ok: true }); }
  if (req.method === "DELETE") { profiles.delete(id); return Response.json({ ok: true }); }
  const p = profiles.get(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(p);
}

async function handleAgentOnboarding(req: Request, profiles: AgentProfileManager, url: URL): Promise<Response> {
  const id = url.pathname.split("/agents/")[1]!.split("/onboarding")[0]!;
  if (req.method === "POST") {
    const answers = await req.json() as any;
    profiles.update(id, { name: answers.name, persona: answers.persona, rules: answers.rules, style: answers.style, theme: answers.theme });
    return Response.json(profiles.get(id));
  }
  const p = profiles.get(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ questions: [
    { field: "name", question: "给这个 Agent 起个名字吧？", placeholder: "如：代码助手、文案大师..." },
    { field: "persona", question: "它的人设是什么样的？", placeholder: "如：资深 Python 后端开发者..." },
    { field: "rules", question: "有什么规则需要遵守？", placeholder: "如：1. 代码需要加注释\n2. 优先使用工具..." },
    { field: "style", question: "对话风格偏好？", placeholder: "如：简洁专业、亲切活泼..." },
  ], profile: p });
}

async function handleAgentMessages(req: Request, store: AgentMessageStore, url: URL): Promise<Response> {
  const agentId = url.pathname.split("/agents/")[1]!.split("/messages")[0]!;
  if (req.method === "POST") {
    const body = await req.json() as any;
    if (body.replace) store.deleteAll(agentId);
    if (body.messages) for (const m of body.messages) store.save(agentId, m);
    return Response.json({ ok: true, count: store.count(agentId) });
  }
  return Response.json(store.load(agentId));
}

async function handleConfigRest(req: Request, config: AutofoxConfig): Promise<Response> {
  if (req.method === "PUT") {
    const partial = await req.json() as Partial<AutofoxConfig>;
    try {
      await writeConfig(config, partial);
      Object.keys(partial).forEach(k => {
        if (partial[k as keyof AutofoxConfig] && config[k as keyof AutofoxConfig] && typeof partial[k as keyof AutofoxConfig] === "object")
          Object.assign(config[k as keyof AutofoxConfig] as any, partial[k as keyof AutofoxConfig]);
      });
      const errors = validateConfig(config);
      return Response.json({ ok: errors.length === 0, errors: errors.length > 0 ? errors : undefined });
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }
  const sanitized = { ...config, model: { ...config.model, api_key: config.model.api_key ? "***" : "" } };
  return Response.json(sanitized);
}

async function handleMarketplaceRest(marketplace: SkillMarketplace, url: URL): Promise<Response> {
  const search = url.searchParams.get("q");
  const items = await marketplace.list();
  if (search) {
    const q = search.toLowerCase();
    return Response.json(items.filter((i: any) => i.name.en.toLowerCase().includes(q) || i.description.en.toLowerCase().includes(q) || i.tags.en.some((t: string) => t.toLowerCase().includes(q))));
  }
  return Response.json(items);
}

async function handleMarketplaceInstall(req: Request, marketplace: SkillMarketplace): Promise<Response> {
  const body = await req.json() as { skillId: string };
  const { SKILLS_DIR } = await import("../config/types");
  return Response.json({ ok: await marketplace.install(body.skillId, SKILLS_DIR) });
}

async function handleInstalledSkills(manager: InstalledSkillsManager): Promise<Response> {
  return Response.json({ ok: true, skills: manager.list() });
}
