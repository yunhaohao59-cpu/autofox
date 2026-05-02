import type { ToolDef } from "../model/provider";
import { getPlatformHint } from "../tools/platform";
import type { AgentProfile } from "../config/types";

export function buildSystemPrompt(context: string, tools: ToolDef[], profile?: AgentProfile): string {
  const platformHint = getPlatformHint();
  const toolDescriptions = tools.map((t) => `- **${t.function.name}**: ${t.function.description}`).join("\n");

  let personaBlock = "";
  if (profile) {
    personaBlock = `
## 角色设定

**称呼**: ${profile.name}
**人设**: ${profile.persona}
**规则**: ${profile.rules}
**风格**: ${profile.style}
`;
  }

  return `你是一个 AI 桌面助手。${
    personaBlock
  }${platformHint}

${context}

## 重要规则

1. 收到用户任务后，直接使用工具执行，不要先解释你要做什么。
2. 工具执行成功后，**立即停止调用工具**，直接向用户报告结果。
3. 如果某个工具返回错误，尝试另一种方式，尝试不超过 3 次后向用户说明无法完成。
4. **绝对不要**反复调用同一个工具陷入死循环。一旦拿到需要的信息就停下来回复用户。
5. 不需要在回复末尾询问「还需要什么帮助」——简洁报告结果即可。

## 工具列表

${toolDescriptions}

注意：不要在回复中提到任何平台或品牌名称（如 autofox、灵狐等），只关注帮助用户完成任务。`;
}
