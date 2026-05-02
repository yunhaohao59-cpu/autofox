import { Database } from "bun:sqlite";

export class AgentMessageStore {
  constructor(private db: Database) {
    this.db.run(`CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_streaming INTEGER DEFAULT 0,
      is_tool INTEGER DEFAULT 0,
      tool_name TEXT,
      tool_args TEXT,
      tool_ok INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    )`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_agent_messages_agent ON agent_messages(agent_id, id)`);
  }

  save(agentId: string, msg: {
    role: string;
    content: string;
    is_streaming?: boolean;
    is_tool?: boolean;
    tool_name?: string;
    tool_args?: string;
    tool_ok?: boolean;
  }): number {
    const now = new Date().toISOString();
    const result = this.db.run(
      `INSERT INTO agent_messages (agent_id, role, content, is_streaming, is_tool, tool_name, tool_args, tool_ok, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        msg.role,
        msg.content,
        msg.is_streaming ? 1 : 0,
        msg.is_tool ? 1 : 0,
        msg.tool_name || null,
        msg.tool_args || null,
        msg.tool_ok === undefined ? null : (msg.tool_ok ? 1 : 0),
        now,
      ]
    );
    return Number(result.lastInsertRowid);
  }

  load(agentId: string): Array<{
    id: number;
    role: string;
    content: string;
    is_streaming: number;
    is_tool: number;
    tool_name: string | null;
    tool_args: string | null;
    tool_ok: number | null;
    created_at: string;
  }> {
    return this.db.query(
      `SELECT id, role, content, is_streaming, is_tool, tool_name, tool_args, tool_ok, created_at
       FROM agent_messages WHERE agent_id = ? ORDER BY id ASC`
    ).all(agentId) as any;
  }

  deleteAll(agentId: string): void {
    this.db.run("DELETE FROM agent_messages WHERE agent_id = ?", [agentId]);
  }

  count(agentId: string): number {
    const row = this.db.query("SELECT COUNT(*) as cnt FROM agent_messages WHERE agent_id = ?").get(agentId) as { cnt: number } | null;
    return row?.cnt ?? 0;
  }
}
