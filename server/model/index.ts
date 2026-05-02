import { DeepSeekProvider } from "./deepseek";
import { OpenAIProvider } from "./openai";
import { ClaudeProvider } from "./claude";
import type { ChatProvider } from "./provider";

export type { ChatProvider, ChatCompletionRequest, ChatCompletionResponse, StreamEvent } from "./provider";

const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn",
  minimax: "https://api.minimax.chat/v1",
  mimo: "https://api.mimoai.cn/v1",
  kimi: "https://api.moonshot.cn",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode",
  baichuan: "https://api.baichuan-ai.com",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
  stepfun: "https://api.stepfun.com",
  claude: "https://api.anthropic.com",
};

export function createProvider(provider: string, apiKey: string, baseUrl?: string): ChatProvider {
  const resolvedBaseUrl = baseUrl || PROVIDER_BASE_URLS[provider];
  switch (provider) {
    case "deepseek":
      return new DeepSeekProvider(apiKey, resolvedBaseUrl);
    case "openai":
    case "zhipu":
    case "moonshot":
    case "minimax":
    case "mimo":
    case "kimi":
    case "qwen":
    case "baichuan":
    case "doubao":
    case "stepfun":
    case "openai-compatible":
    case "custom":
      return new OpenAIProvider(apiKey, resolvedBaseUrl);
    case "claude":
      return new ClaudeProvider(apiKey, resolvedBaseUrl);
    default:
      return new OpenAIProvider(apiKey, resolvedBaseUrl || `https://api.${provider}.com`);
  }
}
