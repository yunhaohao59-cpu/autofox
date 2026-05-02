export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDef[];
  stream?: boolean;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}

export interface ChatProvider {
  readonly name: string;
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatStream(req: ChatCompletionRequest): AsyncGenerator<StreamEvent>;
}

export interface ChatCompletionResponse {
  content: string;
  tool_calls?: ToolCall[];
  finish_reason: "stop" | "tool_calls" | "length";
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; finish_reason: string };
