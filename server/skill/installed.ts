import type { Database } from "bun:sqlite";

export class InstalledSkillsManager {
  constructor(private db: Database) {}

  list(): Array<{
    id: string;
    name: string;
    description: string;
    installed_at: string;
    source: string;
  }> {
    return this.db.query(
      "SELECT id, name, description, installed_at, source FROM skills ORDER BY installed_at DESC"
    ).all() as Array<{
      id: string;
      name: string;
      description: string;
      installed_at: string;
      source: string;
    }>;
  }

  has(id: string): boolean {
    const row = this.db.query("SELECT id FROM skills WHERE id = ?").get(id);
    return row !== null;
  }

  remove(id: string): boolean {
    const result = this.db.run("DELETE FROM skills WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
