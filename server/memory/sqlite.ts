import { Database } from "bun:sqlite";

export class SQLiteDB {
  private db: Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, name TEXT, created_at TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, created_at TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, description TEXT, trigger TEXT, action TEXT, embedding BLOB, installed_at TEXT, source TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, content TEXT, embedding BLOB, created_at TEXT)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS agent_profiles (id TEXT PRIMARY KEY, name TEXT, persona TEXT, rules TEXT, style TEXT, theme TEXT DEFAULT 'dark-orange', model TEXT, provider TEXT, created_at TEXT, updated_at TEXT)`);
  }

  getDb(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
