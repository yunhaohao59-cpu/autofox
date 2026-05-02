import type { Tool, ToolResult } from "../../tools/platform";

const NETWORK_TIMEOUT_MS = 15_000;
const NETWORK_MAX_CHARS = 8_000;

export const networkAdapter = {
  async httpGet(url: string, headers?: Record<string, string>): Promise<{ body: string; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
      const body = await res.text();
      return { body, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  },

  async httpPost(url: string, body: string, headers?: Record<string, string>): Promise<{ body: string; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body,
        signal: controller.signal,
        redirect: "follow",
      });
      const text = await res.text();
      return { body: text, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  },
};

function truncate(text: string): string {
  if (text.length <= NETWORK_MAX_CHARS) return text;
  return text.slice(0, NETWORK_MAX_CHARS) + `\n... (${text.length - NETWORK_MAX_CHARS} more chars)`;
}

export function createHttpGetTool(): Tool {
  return {
    definition: {
      name: "http_get",
      description: "Perform an HTTP GET request to the given URL. Returns response body (first 8KB). Follows redirects automatically.",
      parameters: {
        url: { type: "string", description: "The URL to fetch", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const { body, status } = await networkAdapter.httpGet(args.url as string);
        const result = status >= 400 ? `HTTP ${status}\n${truncate(body)}` : truncate(body);
        return { ok: status < 400, summary: result, detail: `status: ${status}` };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("aborted") || msg.includes("AbortError")) {
          return { ok: false, summary: `HTTP GET timed out after ${NETWORK_TIMEOUT_MS}ms` };
        }
        return { ok: false, summary: `HTTP GET error: ${msg}` };
      }
    },
  };
}

export function createHttpPostTool(): Tool {
  return {
    definition: {
      name: "http_post",
      description: "Perform an HTTP POST request with a JSON body. Returns response body (first 8KB). Follows redirects automatically.",
      parameters: {
        url: { type: "string", description: "The URL to post to", required: true },
        body: { type: "string", description: "JSON body to send", required: true },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const { body, status } = await networkAdapter.httpPost(args.url as string, args.body as string);
        const result = status >= 400 ? `HTTP ${status}\n${truncate(body)}` : truncate(body);
        return { ok: status < 400, summary: result, detail: `status: ${status}` };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("aborted") || msg.includes("AbortError")) {
          return { ok: false, summary: `HTTP POST timed out after ${NETWORK_TIMEOUT_MS}ms` };
        }
        return { ok: false, summary: `HTTP POST error: ${msg}` };
      }
    },
  };
}

export function createNetworkTools(): Tool[] {
  return [createHttpGetTool(), createHttpPostTool()];
}
