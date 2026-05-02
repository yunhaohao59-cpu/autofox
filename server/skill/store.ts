import type { Database } from "bun:sqlite";
import { VectorStore } from "../memory/vector";

export class SkillStore {
  private vectorStore = new VectorStore();

  constructor(private db: Database) {}

  async insert(skill: {
    id: string;
    name: string;
    description: string;
    trigger: string;
    action: string;
    source: string;
  }): Promise<void> {
    const embedding = this.vectorStore.embed(skill.name + " " + skill.description);
    this.db.run(
      `INSERT OR REPLACE INTO skills (id, name, description, trigger, action, embedding, installed_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        skill.id,
        skill.name,
        skill.description,
        skill.trigger,
        skill.action,
        Buffer.from(embedding.buffer),
        new Date().toISOString(),
        skill.source,
      ]
    );
  }

  match(query: string, threshold: number): Array<{ name: string; description: string; action: string }> {
    const queryVec = this.vectorStore.embed(query);
    const rows = this.db.query("SELECT name, description, action, embedding FROM skills").all() as Array<{
      name: string; description: string; action: string; embedding: Buffer;
    }>;
    return rows
      .map((row) => ({
        name: row.name,
        description: row.description,
        action: row.action,
        score: this.vectorStore.similarity(queryVec, new Float64Array(row.embedding.buffer)),
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }
}
