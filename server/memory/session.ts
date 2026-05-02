import type { Database } from "bun:sqlite";

export class SessionManager {
  constructor(private db: Database) {}

  create(name?: string): string {
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    this.db.run("INSERT INTO sessions (id, name, created_at) VALUES (?, ?, ?)", [
      id, name || `Session ${ts.slice(0, 19)}`, ts,
    ]);
    return id;
  }

  list(): Array<{ id: string; name: string; created_at: string }> {
    return this.db.query("SELECT id, name, created_at FROM sessions ORDER BY created_at DESC").all() as Array<{
      id: string; name: string; created_at: string;
    }>;
  }

  rename(id: string, name: string): void {
    this.db.run("UPDATE sessions SET name = ? WHERE id = ?", [name, id]);
  }

  delete(id: string): void {
    this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
    this.db.run("DELETE FROM chats WHERE session_id = ?", [id]);
  }

  addChat(sessionId: string, role: string, content: string): void {
    this.db.run("INSERT INTO chats (session_id, role, content, created_at) VALUES (?, ?, ?, ?)", [
      sessionId, role, content, new Date().toISOString(),
    ]);
  }

  getChats(sessionId: string, limit = 100): Array<{ role: string; content: string }> {
    return this.db.query(
      `SELECT role, content FROM chats WHERE session_id = ? ORDER BY id DESC LIMIT ?`
    ).all(sessionId, limit) as Array<{ role: string; content: string }>;
  }
}
