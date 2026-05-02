import type { Database } from "bun:sqlite";
import { VectorStore } from "../memory/vector";

export class SkillMatcher {
  private vectorStore = new VectorStore();

  constructor(private db: Database) {}

  match(query: string, threshold: number): Array<{ name: string; description: string; action: string; score: number }> {
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
