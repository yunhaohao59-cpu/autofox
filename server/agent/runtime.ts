import { ToolRegistry } from "./tool-registry";
import { createProvider } from "../model";
import type { ChatMessage, ToolCall } from "../model/provider";
import type { AutofoxConfig } from "../config/types";
import { buildSystemPrompt } from "./system-prompt";
import { VisionPipeline } from "../vision/pipeline";
import { ContextCompressor } from "../memory/compressor";
import { SkillMatcher } from "../skill/matcher";
import { SkillExecutor, type SkillMatch } from "../skill/executor";
import { SkillRefiner } from "../skill/refiner";
import { SkillStore } from "../skill/store";
import type { AgentProfile } from "../config/types";
import type { Database } from "bun:sqlite";

const MAX_TOOL_LOOPS = 50;
const VISION_KEYWORDS = /(截图|屏幕|桌面|浏览器|看|screenshot|screen|desktop|see|look|view|browser|网页|打开.*页)/i;
const COMPACTION_THRESHOLD = 64000;
const SKILL_MATCH_THRESHOLD = 0.65;

export interface AgentEvents {
  onTextDelta?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, ok: boolean, summary: string) => void;
  onVision?: (strategy: string, description: string) => void;
  onCompaction?: (originalCount: number, compactedTo: number) => void;
  onSkillMatch?: (skill: SkillMatch) => void;
  onSkillRefined?: (name: string) => void;
}

export class AgentRuntime {
  private tools = new ToolRegistry();
  private messages: ChatMessage[] = [];
  private vision: VisionPipeline;
  private compressor: ContextCompressor;
  private skillMatcher: SkillMatcher;
  private skillExecutor = new SkillExecutor();
  private skillRefiner?: SkillRefiner;
  private events?: AgentEvents;
  private agentProfile?: AgentProfile;

  constructor(
    private config: AutofoxConfig,
    events?: AgentEvents,
    db?: Database,
    agentProfile?: AgentProfile,
  ) {
    this.vision = new VisionPipeline(config);
    this.compressor = new ContextCompressor(
      config.model.provider,
      config.model.model,
      config.model.api_key
    );
    this.skillMatcher = new SkillMatcher(db || null as unknown as Database);
    this.events = events;
    this.agentProfile = agentProfile;

    if (db && config.skill.auto_refine && config.model.api_key) {
      const store = new SkillStore(db);
      this.skillRefiner = new SkillRefiner(store, config.model.provider, config.model.model, config.model.api_key);
    }
  }

  registerTools(tools: ToolRegistry): void {
    this.tools = tools;
  }

  async *run(userMessage: string, images?: Buffer[]): AsyncGenerator<string> {
    const { model } = this.config;
    const provider = createProvider(model.provider, model.api_key, model.base_url);

    let userContent = userMessage;

    // ─── Skill matching ───
    if (this.skillMatcher) {
      try {
        const matches = this.skillMatcher.match(userMessage, SKILL_MATCH_THRESHOLD);
        if (matches.length > 0) {
          const best = matches[0]!;
          const enhanced = this.skillExecutor.inject(best, userMessage);
          userContent = enhanced;
          this.events?.onSkillMatch?.(best);
        }
      } catch {}
    }

    // ─── Vision pre-processing ───
    const hasVisionKeyword = VISION_KEYWORDS.test(userMessage);
    if (hasVisionKeyword || (images && images.length > 0)) {
      const screenshots = images ?? await this.captureScreenshot();
      if (screenshots && screenshots.length > 0) {
        const result = await this.vision.route(screenshots);
        if (result) {
          userContent = `[Vision description (${result.strategy}): ${result.description}]\n\n${userContent}`;
          this.events?.onVision?.(result.strategy, result.description);
          yield `\n[视觉处理: ${result.strategy} 模式 — ${result.description.slice(0, 100)}...]\n\n`;
        }
      }
    }

    this.messages.push({ role: "user" as const, content: userContent });

    const systemMsg: ChatMessage = {
      role: "system" as const,
      content: buildSystemPrompt("", this.tools.listDefinitions(), this.agentProfile),
    };

    let loopCount = 0;
    let assistantResponse = "";

    while (loopCount < MAX_TOOL_LOOPS) {
      loopCount++;

      // ─── Context compaction ───
      await this.maybeCompact(systemMsg);

      const request = {
        model: model.model,
        messages: [systemMsg, ...this.messages],
        temperature: 0.7,
        max_tokens: 4096,
        tools: this.tools.listDefinitions(),
      };

      let fullContent = "";
      const toolCalls: ToolCall[] = [];

      try {
        for await (const event of provider.chatStream(request)) {
          if (event.type === "text_delta") {
            fullContent += event.text;
            yield event.text;
            this.events?.onTextDelta?.(event.text);
          } else if (event.type === "tool_call") {
            toolCalls.push(event.call);
            this.events?.onToolCall?.(event.call.name, event.call.arguments);
          } else if (event.type === "done" && event.finish_reason === "error") {
            const errMsg = "\n[请求失败，请检查 API Key 和网络连接]";
            yield errMsg;
            return;
          }
        }
      } catch (e) {
        const errMsg = `\n[错误: ${e instanceof Error ? e.message : String(e)}]`;
        yield errMsg;
        return;
      }

      if (toolCalls.length === 0) {
        assistantResponse = fullContent;
        this.messages.push({ role: "assistant" as const, content: fullContent });
        break;
      }

      this.messages.push({
        role: "assistant" as const,
        content: fullContent || "(tool calls)",
      });

      const toolOutputs: string[] = [];
      for (const call of toolCalls) {
        const result = await this.tools.execute(call.name, call.arguments);
        const ok = !result.startsWith("Error:");
        toolOutputs.push(`[tool: ${call.name}]\n${result}`);
        this.events?.onToolResult?.(call.name, ok, result.slice(0, 200));
      }

      this.messages.push({
        role: "user" as const,
        content: "Tool execution results:\n\n" + toolOutputs.join("\n\n"),
      });
    }

    if (loopCount >= MAX_TOOL_LOOPS) {
      yield "\n[已达到最大工具调用轮数]";
    }

    // ─── Auto-refine skill after task ───
    if (this.skillRefiner && assistantResponse) {
      try {
        const refinedName = await this.skillRefiner.refine(userMessage, assistantResponse);
        if (refinedName) {
          this.events?.onSkillRefined?.(refinedName);
        }
      } catch {}
    }
  }

  private async captureScreenshot(): Promise<Buffer[] | null> {
    const shellTool = this.tools.get("shell");
    if (!shellTool) return null;

    try {
      const r1 = await shellTool.execute({ command: "which import 2>/dev/null || which gnome-screenshot 2>/dev/null || echo none" });
      if (r1.summary.includes("none")) return null;

      if (r1.summary.includes("import")) {
        const r2 = await shellTool.execute({ command: "import -window root /tmp/autofox_screenshot.png 2>/dev/null && echo ok" });
        if (r2.summary.includes("ok")) {
          const file = Bun.file("/tmp/autofox_screenshot.png");
          return [Buffer.from(await file.arrayBuffer())];
        }
      }

      if (r1.summary.includes("gnome-screenshot")) {
        await shellTool.execute({ command: "gnome-screenshot -f /tmp/autofox_screenshot.png 2>/dev/null" });
        try {
          const file = Bun.file("/tmp/autofox_screenshot.png");
          return [Buffer.from(await file.arrayBuffer())];
        } catch {
          return null;
        }
      }
    } catch {}
    return null;
  }

  private async maybeCompact(systemMsg: ChatMessage): Promise<void> {
    const totalChars = this.messages.reduce((s, m) => s + m.content.length, 0);
    if (totalChars < COMPACTION_THRESHOLD) return;

    try {
      const summary = await this.compressor.compress(
        this.messages.map((m) => ({ role: m.role, content: m.content })),
        COMPACTION_THRESHOLD
      );

      if (summary) {
        const originalCount = this.messages.length;
        this.messages = [{
          role: "user" as const,
          content: `[Previous conversation summary]\n${summary}\n\n[Continuing from above summary]`,
        }];
        this.events?.onCompaction?.(originalCount, 1);
      }
    } catch {}
  }
}
