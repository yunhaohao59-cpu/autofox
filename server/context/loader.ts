import type { AutofoxConfig } from "../config/types";

export async function loadContext(): Promise<string> {
  const files = ["./AGENTS.md", "./.autofox/context.md", "./README.md"];
  let context = "";

  for (const file of files) {
    try {
      const content = await Bun.file(file).text();
      if (content.length > 0) {
        context += `\n## ${file}\n\n${content}`;
      }
    } catch {
      // file doesn't exist, skip
    }
  }

  return context;
}
