export interface Frame {
  type: "req" | "event" | "res";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ChatRequest {
  session_id?: string;
  message: string;
  images?: string[];
}

export interface ChatResponse {
  session_id: string;
  content: string;
  finish_reason: "stop" | "tool_calls" | "length" | "error";
  tool_calls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: {
    ok: boolean;
    summary: string;
  };
}

export interface SessionInfo {
  id: string;
  name: string;
  created_at: string;
  message_count: number;
}

export interface SkillMarketItem {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  tags: { en: string[]; zh: string[] };
  downloads: number;
  author: string;
  version: string;
  compatibility: { min_version: string; platforms: string[] };
}
