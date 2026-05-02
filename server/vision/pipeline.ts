import type { AutofoxConfig } from "../config/types";
import { SimpleEdgeDetector } from "./edge-detector";
import type { EdgeResult } from "./edge-detector";

export interface VisionResult {
  description: string;
  strategy: "native" | "bridge" | "edge";
  tokensUsed?: number;
  edgeResult?: EdgeResult;
}

export class VisionPipeline {
  private edgeDetector = new SimpleEdgeDetector();

  constructor(private config: AutofoxConfig) {}

  async route(images: Buffer[]): Promise<VisionResult | null> {
    const vc = this.config.vision;
    if (!vc.enabled || vc.strategy === "off" || images.length === 0) return null;

    switch (vc.strategy) {
      case "native":
        return null;
      case "bridge":
        return this.bridgeStrategy(images);
      case "edge":
        return this.edgeStrategy(images);
      default:
        return null;
    }
  }

  private async bridgeStrategy(images: Buffer[]): Promise<VisionResult> {
    const vc = this.config.vision;
    const apiKey = vc.api_key || this.config.model.api_key;

    if (!apiKey) {
      return { description: "No vision model API key configured", strategy: "bridge" };
    }

    const baseUrl = this.getBaseUrl(vc.provider);
    const base64Images = images.map((buf) => buf.toString("base64"));

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: vc.model,
          max_tokens: vc.max_tokens,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe what you see in this screenshot in detail, focusing on UI elements, text content, and interactive components. Be concise.",
              },
              ...base64Images.map((b64) => ({
                type: "image_url",
                image_url: { url: `data:image/png;base64,${b64}` },
              })),
            ],
          }],
        }),
      });

      const json = await res.json() as Record<string, unknown>;
      const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      return {
        description: (message?.content as string) || "(no description)",
        strategy: "bridge",
        tokensUsed: (json.usage as Record<string, number>)?.total_tokens,
      };
    } catch (e) {
      return {
        description: `Vision bridge failed: ${e instanceof Error ? e.message : String(e)}`,
        strategy: "bridge",
      };
    }
  }

  private async edgeStrategy(images: Buffer[]): Promise<VisionResult> {
    const results: EdgeResult[] = [];
    for (const img of images) {
      const edge = await this.edgeDetector.detect(img);
      results.push(edge);
    }

    const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
    const totalEdge = results.reduce((s, r) => s + r.edgeSize, 0);

    return {
      description: `[edge-detected image: ${totalOriginal} bytes → ${totalEdge} bytes edge map. Use shell + OCR or other means to interpret.]`,
      strategy: "edge",
      edgeResult: results[0],
    };
  }

  private getBaseUrl(provider: string): string {
    switch (provider) {
      case "openai":
        return "https://api.openai.com";
      case "deepseek":
        return "https://api.deepseek.com";
      case "claude":
        return "https://api.anthropic.com";
      default:
        return `https://api.${provider}.com`;
    }
  }
}
