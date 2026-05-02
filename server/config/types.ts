export type Platform = "linux" | "windows" | "macos";

export type VisionStrategy = "native" | "bridge" | "edge" | "off";

export type ThemeId = "dark-orange" | "dark-blue" | "dark-green" | "light-warm" | "midnight-purple";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  nameZh: string;
  variables: Record<string, string>;
}

export interface AgentProfile {
  id: string;
  name: string;
  persona: string;
  rules: string;
  style: string;
  theme: ThemeId;
  model: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  provider: string;
  api_key: string;
  model: string;
  base_url?: string;
}

export interface VisionConfig {
  enabled: boolean;
  strategy: VisionStrategy;
  provider: string;
  model: string;
  api_key?: string;
  max_tokens: number;
  compress: boolean;
}

export interface BrowserConfig {
  enabled: boolean;
  executable: string;
}

export interface MemoryConfig {
  max_session_messages: number;
  compaction_threshold: number;
  auto_compaction: boolean;
  top_k_memories: number;
}

export interface SkillConfig {
  auto_refine: boolean;
  similarity_threshold: number;
  marketplace_url: string;
}

export interface GatewayConfig {
  port: number;
}

export interface AutofoxConfig {
  gateway: GatewayConfig;
  model: ModelConfig;
  vision: VisionConfig;
  browser: BrowserConfig;
  memory: MemoryConfig;
  skill: SkillConfig;
}

export const CHINESE_PROVIDERS: Record<string, { name: string; baseUrl: string; models: string[] }> = {
  "deepseek": { name: "DeepSeek", baseUrl: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  "zhipu": { name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-plus", "glm-4-flash", "glm-4v-plus"] },
  "moonshot": { name: "月之暗面 Kimi", baseUrl: "https://api.moonshot.cn", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  "minimax": { name: "MiniMax", baseUrl: "https://api.minimax.chat/v1", models: ["abab7-chat", "abab6.5s-chat", "abab6.5t-chat"] },
  "mimo": { name: "Mimo", baseUrl: "https://api.mimoai.cn/v1", models: ["mimo-chat", "mimo-pro"] },
  "kimi": { name: "Kimi (月之暗面)", baseUrl: "https://api.moonshot.cn", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  "qwen": { name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode", models: ["qwen-plus", "qwen-max", "qwen-turbo"] },
  "baichuan": { name: "百川", baseUrl: "https://api.baichuan-ai.com", models: ["Baichuan4", "Baichuan3-Turbo"] },
  "doubao": { name: "豆包 (字节)", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: ["doubao-pro-32k", "doubao-lite-32k"] },
  "stepfun": { name: "阶跃星辰", baseUrl: "https://api.stepfun.com", models: ["step-2-16k", "step-1-8k"] },
  "openai": { name: "OpenAI", baseUrl: "https://api.openai.com", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  "claude": { name: "Claude (Anthropic)", baseUrl: "https://api.anthropic.com", models: ["claude-3-opus", "claude-3-sonnet"] },
  "custom": { name: "自定义兼容", baseUrl: "", models: [] },
};

export const PROVIDER_NAMES = Object.entries(CHINESE_PROVIDERS).map(([id, p]) => ({ id, name: p.name }));

export const DEFAULT_CONFIG: AutofoxConfig = {
  gateway: { port: 18900 },
  model: { provider: "deepseek", api_key: "", model: "deepseek-chat", base_url: "" },
  vision: { enabled: true, strategy: "bridge", provider: "openai", model: "gpt-4o-mini", api_key: "", max_tokens: 1024, compress: true },
  browser: { enabled: true, executable: "" },
  memory: { max_session_messages: 100, compaction_threshold: 64000, auto_compaction: true, top_k_memories: 3 },
  skill: { auto_refine: true, similarity_threshold: 0.75, marketplace_url: "https://raw.githubusercontent.com/autofox/skills/main/index.json" },
};

export const DEFAULT_AGENT_PROFILE: Omit<AgentProfile, "id" | "created_at" | "updated_at"> = {
  name: "助手",
  persona: "你是一个智能、友好、乐于助人的 AI 助手。",
  rules: "1. 优先使用工具完成任务\n2. 回答简洁准确\n3. 不确定时主动询问",
  style: "专业但亲切，适当使用表情符号",
  theme: "dark-orange",
  model: "deepseek-chat",
  provider: "deepseek",
};

export const THEMES: ThemeConfig[] = [
  {
    id: "dark-orange", name: "Dark Orange", nameZh: "暗夜橙",
    variables: {
      "--bg-primary": "#1a1b1e", "--bg-secondary": "#25262b", "--bg-tertiary": "#2c2e33",
      "--bg-hover": "#373a40", "--text-primary": "#c1c2c5", "--text-secondary": "#909296",
      "--text-bright": "#ffffff", "--border-color": "#373a40", "--accent": "#f08c00",
      "--accent-hover": "#e67e22", "--danger": "#e03131",
    },
  },
  {
    id: "dark-blue", name: "Dark Blue", nameZh: "暗夜蓝",
    variables: {
      "--bg-primary": "#0f172a", "--bg-secondary": "#1e293b", "--bg-tertiary": "#334155",
      "--bg-hover": "#475569", "--text-primary": "#cbd5e1", "--text-secondary": "#94a3b8",
      "--text-bright": "#f8fafc", "--border-color": "#334155", "--accent": "#3b82f6",
      "--accent-hover": "#2563eb", "--danger": "#ef4444",
    },
  },
  {
    id: "dark-green", name: "Dark Green", nameZh: "暗夜绿",
    variables: {
      "--bg-primary": "#0d1f17", "--bg-secondary": "#152d22", "--bg-tertiary": "#1e3d2f",
      "--bg-hover": "#2a4d3a", "--text-primary": "#a7c4b5", "--text-secondary": "#7a9e8a",
      "--text-bright": "#e8f5e9", "--border-color": "#1e3d2f", "--accent": "#10b981",
      "--accent-hover": "#059669", "--danger": "#f87171",
    },
  },
  {
    id: "light-warm", name: "Light Warm", nameZh: "暖光",
    variables: {
      "--bg-primary": "#fef3c7", "--bg-secondary": "#fde68a", "--bg-tertiary": "#fcd34d",
      "--bg-hover": "#fbbf24", "--text-primary": "#451a03", "--text-secondary": "#78350f",
      "--text-bright": "#1c1917", "--border-color": "#d97706", "--accent": "#f59e0b",
      "--accent-hover": "#d97706", "--danger": "#dc2626",
    },
  },
  {
    id: "midnight-purple", name: "Midnight Purple", nameZh: "深夜紫",
    variables: {
      "--bg-primary": "#181127", "--bg-secondary": "#24193a", "--bg-tertiary": "#352652",
      "--bg-hover": "#4a3470", "--text-primary": "#cfc2e6", "--text-secondary": "#9d8cba",
      "--text-bright": "#f3e8ff", "--border-color": "#352652", "--accent": "#a855f7",
      "--accent-hover": "#7c3aed", "--danger": "#f87171",
    },
  },
];

export const CONFIG_DIR = `${Bun.env.HOME || "~"}/.autofox`;
export const CONFIG_PATH = `${CONFIG_DIR}/config.toml`;
export const DB_PATH = `${CONFIG_DIR}/autofox.db`;
export const SKILLS_DIR = `${CONFIG_DIR}/skills`;
