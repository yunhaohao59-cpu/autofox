import type { AutofoxConfig } from "../config/types";

export class BridgeModel {
  constructor(private config: AutofoxConfig) {}

  async describe(images: Buffer[]): Promise<string> {
    const vc = this.config.vision;
    const apiKey = vc.api_key || this.config.model.api_key;

    if (!apiKey) return "No vision model API key configured";

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
              { type: "text", text: "Describe this screenshot in detail. Focus on UI layout, visible text, buttons, input fields, and any error messages." },
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
      return (message?.content as string) || "";
    } catch {
      return "(vision bridge unavailable)";
    }
  }

  private getBaseUrl(provider: string): string {
    switch (provider) {
      case "openai": return "https://api.openai.com";
      case "deepseek": return "https://api.deepseek.com";
      case "claude": return "https://api.anthropic.com";
      default: return `https://api.${provider}.com`;
    }
  }
}
