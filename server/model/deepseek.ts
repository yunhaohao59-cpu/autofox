import type { ChatProvider, ChatCompletionRequest, ChatCompletionResponse, StreamEvent, ToolCall } from "./provider";

export class DeepSeekProvider implements ChatProvider {
  readonly name = "deepseek";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.deepseek.com";
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ ...req, stream: false }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`DeepSeek API error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json() as Record<string, unknown>;
      const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;

      const rawToolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;
      const toolCalls: ToolCall[] | undefined = rawToolCalls?.map((tc) => ({
        id: tc.id as string,
        name: (tc.function as Record<string, unknown>)?.name as string,
        arguments: JSON.parse(((tc.function as Record<string, unknown>)?.arguments as string) || "{}") as Record<string, unknown>,
      }));

      return {
        content: (message?.content as string) || "",
        tool_calls: toolCalls,
        finish_reason: (choice?.finish_reason as ChatCompletionResponse["finish_reason"]) || "stop",
      };
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("DeepSeek API error")) throw e;
      throw new Error(`DeepSeek request failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async *chatStream(req: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: true }),
    });

    if (!res.ok) {
      const errText = await res.text();
      yield { type: "done", finish_reason: "error" };
      return;
    }

    if (!res.body) {
      yield { type: "done", finish_reason: "stop" };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const pendingToolCalls = new Map<number, { id: string; name: string; args: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          yield { type: "done", finish_reason: "stop" };
          return;
        }

        try {
          const json = JSON.parse(data) as Record<string, unknown>;
          const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
          const delta = choice?.delta as Record<string, unknown> | undefined;

          if (delta?.content) {
            yield { type: "text_delta", text: delta.content as string };
          }

          const deltaToolCalls = delta?.tool_calls as Array<Record<string, unknown>> | undefined;
          if (deltaToolCalls) {
            for (const tc of deltaToolCalls) {
              const idx = tc.index as number;
              if (!pendingToolCalls.has(idx)) {
                pendingToolCalls.set(idx, {
                  id: (tc.id as string) || "",
                  name: "",
                  args: "",
                });
              }
              const pending = pendingToolCalls.get(idx)!;
              if (tc.id) pending.id = tc.id as string;
              const fn = tc.function as Record<string, unknown> | undefined;
              if (fn?.name) pending.name += fn.name as string;
              if (fn?.arguments) pending.args += fn.arguments as string;
            }
          }

          if (choice?.finish_reason === "tool_calls") {
            for (const [, pending] of pendingToolCalls) {
              try {
                yield {
                  type: "tool_call",
                  call: {
                    id: pending.id,
                    name: pending.name,
                    arguments: JSON.parse(pending.args || "{}") as Record<string, unknown>,
                  },
                };
              } catch {
                /* skip malformed tool call */
              }
            }
            pendingToolCalls.clear();
          }

          if (choice?.finish_reason && choice.finish_reason !== "tool_calls") {
            yield { type: "done", finish_reason: choice.finish_reason as string };
            return;
          }
        } catch {
          /* skip malformed chunks */
        }
      }
    }

    yield { type: "done", finish_reason: "stop" };
  }
}
