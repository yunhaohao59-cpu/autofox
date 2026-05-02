import type { Tool, ToolResult } from "../tools/platform";
import type { ToolDef } from "../model/provider";

export type { ToolDef };

const DEFAULT_TIMEOUT_MS = 30_000;
const RESULT_MAX_CHARS = 20_000;

export interface RegistryOptions {
  timeoutMs?: number;
  maxResultChars?: number;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private timeoutMs: number;
  private maxResultChars: number;

  constructor(options: RegistryOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResultChars = options.maxResultChars ?? RESULT_MAX_CHARS;
  }

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  get size(): number {
    return this.tools.size;
  }

  listDefinitions(): ToolDef[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.definition.name,
        description: tool.definition.description,
        parameters: {
          type: "object" as const,
          properties: Object.fromEntries(
            Object.entries(tool.definition.parameters).map(([key, param]) => [
              key,
              { type: param.type, description: param.description },
            ])
          ),
          required: Object.entries(tool.definition.parameters)
            .filter(([, param]) => (param as { required?: boolean }).required)
            .map(([key]) => key),
        },
      },
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return `Error: Tool '${name}' not found.`;

    try {
      const result = await this.executeWithTimeout(tool, args);
      return this.formatResult(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("timed out")) {
        return `Error: Tool '${name}' timed out after ${this.timeoutMs}ms`;
      }
      return `Error: ${msg}`;
    }
  }

  private async executeWithTimeout(tool: Tool, args: Record<string, unknown>): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("tool execution timed out"));
      }, this.timeoutMs);

      tool.execute(args).then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  private formatResult(result: ToolResult): string {
    const summary = result.summary.length > this.maxResultChars
      ? result.summary.slice(0, this.maxResultChars) + `\n... (truncated ${result.summary.length - this.maxResultChars} chars)`
      : result.summary;

    if (!result.ok) return `Error: ${summary}`;
    return summary;
  }
}
