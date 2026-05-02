import { createProvider } from "../model";
import { SkillStore } from "./store";

export class SkillRefiner {
  constructor(private skillStore: SkillStore, private provider: string, private model: string, private apiKey: string) {}

  async refine(task: string, solution: string): Promise<string | null> {
    const provider = createProvider(this.provider, this.apiKey);
    const response = await provider.chat({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are a skill extraction system. Given a task and its solution, extract a reusable skill.

Output in JSON format:
{
  "name": "short skill name",
  "description": "what this skill does",
  "trigger": "keywords or phrases that trigger this skill",
  "action": "the reusable instruction/prompt"
}

If the task doesn't contain a reusable pattern, respond with {"skip": true}.`,
        },
        {
          role: "user",
          content: `Task: ${task}\n\nSolution: ${solution}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    try {
      const json = JSON.parse(response.content);
      if (json.skip) return null;
      await this.skillStore.insert({
        id: json.name.toLowerCase().replace(/\s+/g, "-"),
        name: json.name,
        description: json.description,
        trigger: json.trigger,
        action: json.action,
        source: "auto-refined",
      });
      return json.name;
    } catch {
      return null;
    }
  }
}
