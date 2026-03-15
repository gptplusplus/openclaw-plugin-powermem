import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';

export interface StoredMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export class LocalStore {
  private db: Database.Database;

  constructor(dataDir: string, agentId: string) {
    fs.ensureDirSync(dataDir);
    // Use agentId to create a unique database file for each agent instance
    const safeAgentId = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dbPath = path.join(dataDir, `context_${safeAgentId}.db`);
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index on created_at for faster retrieval if needed
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at)`);
  }

  addMessage(role: string, content: string | object) {
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);
    this.db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run(role, textContent);
  }

  getRecentMessages(limit: number = 20): StoredMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM (
        SELECT id, role, content, created_at 
        FROM messages 
        ORDER BY id DESC 
        LIMIT ?
      ) ORDER BY id ASC
    `).all(limit) as StoredMessage[];
    
    return rows;
  }

  close() {
    this.db.close();
  }
}
