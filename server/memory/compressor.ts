import { createProvider } from "../model";

export class ContextCompressor {
  private provider: string;
  private model: string;
  private apiKey: string;

  constructor(provider: string, model: string, apiKey: string) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
  }

  async compress(messages: Array<{ role: string; content: string }>, threshold: number): Promise<string> {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars < threshold) return "";

    const provider = createProvider(this.provider, this.apiKey);
    const summary = await provider.chat({
      model: this.model,
      messages: [
        { role: "system", content: "Summarize the following conversation concisely, preserving key decisions, facts, and action items." },
        { role: "user", content: messages.map((m) => `${m.role}: ${m.content}`).join("\n") },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });
    return summary.content;
  }
}
