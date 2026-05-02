export type SkillMatch = {
  name: string;
  description: string;
  trigger?: string;
  action: string;
  score: number;
};

export class SkillExecutor {
  inject(skill: SkillMatch, userMessage: string): string {
    return `[Skill activated: ${skill.name} — ${skill.description}]\n\nInstructions: ${skill.action}\n\nUser request: ${userMessage}`;
  }

  extractTriggerPrompt(skills: SkillMatch[], userMessage: string): string | null {
    if (skills.length === 0) return null;

    const bestSkill = skills[0]!;
    if (bestSkill.score < 0.7) return null;

    return `[Skill "${bestSkill.name}" matched (score: ${bestSkill.score.toFixed(2)}): ${bestSkill.description}]
    Refined prompt:
    ${bestSkill.action}

    User request:
    ${userMessage}`;
  }
}
