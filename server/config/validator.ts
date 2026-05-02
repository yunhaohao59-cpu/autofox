import type { AutofoxConfig, VisionStrategy, Platform } from "./types";

export interface ValidationError {
  path: string;
  message: string;
}

const VALID_PROVIDERS = ["deepseek", "openai", "claude", "zhipu", "moonshot", "minimax", "mimo", "kimi", "qwen", "baichuan", "doubao", "stepfun", "custom"];
const VALID_VISION_STRATEGIES: VisionStrategy[] = ["native", "bridge", "edge", "off"];

export function validateConfig(config: AutofoxConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.gateway) {
    errors.push({ path: "gateway", message: "gateway config is required" });
  } else {
    if (typeof config.gateway.port !== "number" || config.gateway.port < 1024 || config.gateway.port > 65535) {
      errors.push({ path: "gateway.port", message: "port must be between 1024 and 65535" });
    }
  }

  if (!config.model) {
    errors.push({ path: "model", message: "model config is required" });
  } else {
    if (!config.model.provider) {
      errors.push({ path: "model.provider", message: "provider is required" });
    } else if (!VALID_PROVIDERS.includes(config.model.provider)) {
      errors.push({ path: "model.provider", message: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` });
    }
    if (!config.model.model) {
      errors.push({ path: "model.model", message: "model name is required" });
    }
  }

  if (config.vision?.enabled) {
    if (!VALID_VISION_STRATEGIES.includes(config.vision.strategy)) {
      errors.push({ path: "vision.strategy", message: `strategy must be one of: ${VALID_VISION_STRATEGIES.join(", ")}` });
    }
    if (config.vision.strategy !== "off" && config.vision.strategy !== "edge") {
      if (!config.vision.provider) {
        errors.push({ path: "vision.provider", message: "vision provider is required for this strategy" });
      }
      if (!config.vision.model) {
        errors.push({ path: "vision.model", message: "vision model is required for this strategy" });
      }
    }
  }

  if (config.memory) {
    if (config.memory.compaction_threshold < 1000) {
      errors.push({ path: "memory.compaction_threshold", message: "threshold must be at least 1000" });
    }
  }

  if (config.skill) {
    if (typeof config.skill.similarity_threshold !== "number" || config.skill.similarity_threshold < 0 || config.skill.similarity_threshold > 1) {
      errors.push({ path: "skill.similarity_threshold", message: "similarity_threshold must be between 0 and 1" });
    }
  }

  return errors;
}

export function isSetupComplete(config: AutofoxConfig): boolean {
  return config.model.api_key.length > 0;
}
