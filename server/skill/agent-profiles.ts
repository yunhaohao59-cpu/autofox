import type { Database } from "bun:sqlite";
import type { AgentProfile, ThemeId } from "../config/types";
import { DEFAULT_AGENT_PROFILE } from "../config/types";

export class AgentProfileManager {
  constructor(private db: Database) {}

  create(partial?: Partial<Omit<AgentProfile, "id" | "created_at" | "updated_at">>): AgentProfile {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const profile: AgentProfile = {
      ...DEFAULT_AGENT_PROFILE,
      ...partial,
      id,
      created_at: now,
      updated_at: now,
    };
    this.db.run(
      `INSERT INTO agent_profiles (id, name, persona, rules, style, theme, model, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [profile.id, profile.name, profile.persona, profile.rules, profile.style, profile.theme, profile.model, profile.provider, profile.created_at, profile.updated_at]
    );
    return profile;
  }

  get(id: string): AgentProfile | null {
    const row = this.db.query("SELECT * FROM agent_profiles WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!row) return null;
    return row as unknown as AgentProfile;
  }

  list(): AgentProfile[] {
    return this.db.query("SELECT * FROM agent_profiles ORDER BY updated_at DESC").all() as unknown as AgentProfile[];
  }

  update(id: string, partial: Partial<Omit<AgentProfile, "id" | "created_at" | "updated_at">>): boolean {
    const existing = this.get(id);
    if (!existing) return false;

    const merged = { ...existing, ...partial, updated_at: new Date().toISOString() };
    this.db.run(
      `UPDATE agent_profiles SET name=?, persona=?, rules=?, style=?, theme=?, model=?, provider=?, updated_at=? WHERE id=?`,
      [merged.name, merged.persona, merged.rules, merged.style, merged.theme, merged.model, merged.provider, merged.updated_at, id]
    );
    return true;
  }

  delete(id: string): boolean {
    const result = this.db.run("DELETE FROM agent_profiles WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
