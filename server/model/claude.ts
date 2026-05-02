import type { ChatProvider, ChatCompletionRequest, ChatCompletionResponse, StreamEvent } from "./provider";

export class ClaudeProvider implements ChatProvider {
  readonly name = "claude";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.anthropic.com";
  }

  async chat(_req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    throw new Error("Claude provider not yet implemented. Use OpenAI-compatible endpoint.");
  }

  async *chatStream(_req: ChatCompletionRequest): AsyncGenerator<StreamEvent> {
    throw new Error("Claude provider not yet implemented. Use OpenAI-compatible endpoint.");
  }
}
