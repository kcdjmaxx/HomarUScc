// DocsIndex — generic domain-specific vector DB for documentation
// Reuses the same embedding pipeline as MemoryIndex but with separate DBs per domain
// No temporal decay, no dream scoring — pure reference lookup
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import type { Logger } from "./types.js";
import type { EmbeddingProvider } from "./memory-index.js";

export interface DocsSearchResult {
  domain: string;
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
}

interface Chunk {
  path: string;
  index: number;
  content: string;
}

interface DomainDB {
  db: import("better-sqlite3").Database;
  domain: string;
  dbPath: string;
}

export class DocsIndex {
  private domains = new Map<string, DomainDB>();
  private embeddingProvider: EmbeddingProvider | null = null;
  private baseDir: string;
  private chunkSize: number;
  private chunkOverlap: number;
  private vectorWeight: number;
  private ftsWeight: number;
  private logger: Logger;

  constructor(logger: Logger, options?: {
    baseDir?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    vectorWeight?: number;
    ftsWeight?: number;
  }) {
    this.logger = logger;
    this.baseDir = options?.baseDir ?? join(process.env.HOME ?? "~", ".homaruscc", "docs");
    this.chunkSize = options?.chunkSize ?? 400;
    this.chunkOverlap = options?.chunkOverlap ?? 80;
    this.vectorWeight = options?.vectorWeight ?? 0.7;
    this.ftsWeight = options?.ftsWeight ?? 0.3;
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  private async getOrCreateDomain(domain: string): Promise<DomainDB> {
    const existing = this.domains.get(domain);
    if (existing) return existing;

    const dbPath = join(this.baseDir, `${domain}.sqlite`);
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }

    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    try {
      const sqliteVec = await import("sqlite-vec");
      (sqliteVec as { load: (db: unknown) => void }).load(db);
    } catch {
      this.logger.warn("sqlite-vec not available for docs domain", { domain });
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(path, chunk_index)
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
    `);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content, content='chunks', content_rowid='id'
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
        INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
      END;
    `);

    try {
      const dims = this.embeddingProvider?.dimensions() ?? 768;
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
          chunk_id INTEGER PRIMARY KEY,
          embedding float[${dims}]
        );
      `);
    } catch {
      this.logger.debug("Vector table creation skipped for docs domain", { domain });
    }

    const domainDB: DomainDB = { db, domain, dbPath };
    this.domains.set(domain, domainDB);
    this.logger.info("Docs domain initialized", { domain, dbPath });
    return domainDB;
  }

  async ingest(domain: string, path: string): Promise<{ filesProcessed: number; chunksCreated: number }> {
    const { db } = await this.getOrCreateDomain(domain);

    if (!existsSync(path)) {
      throw new Error(`Path not found: ${path}`);
    }

    const stat = (await import("node:fs")).statSync(path);
    let files: string[];

    if (stat.isDirectory()) {
      files = this.findFiles(path);
    } else {
      files = [path];
    }

    let totalChunks = 0;
    for (const file of files) {
      const chunks = await this.indexFile(db, file);
      totalChunks += chunks;
    }

    this.logger.info("Docs ingested", { domain, files: files.length, chunks: totalChunks });
    return { filesProcessed: files.length, chunksCreated: totalChunks };
  }

  async ingestText(domain: string, key: string, content: string): Promise<{ chunksCreated: number }> {
    const { db } = await this.getOrCreateDomain(domain);
    const chunks = this.chunkContent(content, key);
    const now = Date.now();

    db.prepare("DELETE FROM chunks WHERE path = ?").run(key);

    const insert = db.prepare(
      "INSERT INTO chunks (path, chunk_index, content, updated_at) VALUES (?, ?, ?, ?)"
    );
    const insertMany = db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        insert.run(chunk.path, chunk.index, chunk.content, now);
      }
    });
    insertMany(chunks);

    if (this.embeddingProvider) {
      try {
        const texts = chunks.map((c) => c.content);
        const embeddings = await this.embeddingProvider.embedBatch(texts);
        const rows = db.prepare("SELECT id FROM chunks WHERE path = ? ORDER BY chunk_index")
          .all(key) as Array<{ id: number }>;

        const insertVec = db.prepare(
          "INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)"
        );
        const insertVecs = db.transaction(() => {
          for (let i = 0; i < rows.length && i < embeddings.length; i++) {
            const embBuf = new Uint8Array(new Float32Array(embeddings[i]).buffer);
            insertVec.run(rows[i].id, embBuf);
          }
        });
        insertVecs();
      } catch (err) {
        this.logger.warn("Failed to generate embeddings for docs", { key, error: String(err) });
      }
    }

    return { chunksCreated: chunks.length };
  }

  async search(domain: string, query: string, limit = 10): Promise<DocsSearchResult[]> {
    const domainDB = this.domains.get(domain);
    if (!domainDB) {
      // Try to open if it exists on disk
      const dbPath = join(this.baseDir, `${domain}.sqlite`);
      if (!existsSync(dbPath)) {
        return [];
      }
      await this.getOrCreateDomain(domain);
      return this.search(domain, query, limit);
    }

    const { db } = domainDB;
    const results = new Map<number, { path: string; content: string; score: number; chunkIndex: number }>();

    // FTS search
    try {
      const ftsResults = db.prepare(`
        SELECT c.id, c.path, c.content, c.chunk_index,
               bm25(chunks_fts) AS rank
        FROM chunks_fts f
        JOIN chunks c ON c.id = f.rowid
        WHERE chunks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit * 2) as Array<{
        id: number; path: string; content: string; chunk_index: number; rank: number;
      }>;

      const maxRank = ftsResults.length > 0 ? Math.max(...ftsResults.map((r) => Math.abs(r.rank))) : 1;
      for (const row of ftsResults) {
        const normalizedScore = maxRank > 0 ? Math.abs(row.rank) / maxRank : 0;
        results.set(row.id, {
          path: row.path,
          content: row.content,
          score: normalizedScore * this.ftsWeight,
          chunkIndex: row.chunk_index,
        });
      }
    } catch {
      // FTS query may fail on certain inputs
    }

    // Vector search
    if (this.embeddingProvider) {
      try {
        const queryEmb = await this.embeddingProvider.embed(query);
        const vecResults = db.prepare(`
          SELECT chunk_id, distance
          FROM chunks_vec
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
        `).all(new Uint8Array(new Float32Array(queryEmb).buffer), limit * 2) as Array<{
          chunk_id: number; distance: number;
        }>;

        for (const row of vecResults) {
          const similarity = 1 - row.distance;
          const existing = results.get(row.chunk_id);
          if (existing) {
            existing.score += similarity * this.vectorWeight;
          } else {
            const chunk = db.prepare("SELECT path, content, chunk_index FROM chunks WHERE id = ?")
              .get(row.chunk_id) as { path: string; content: string; chunk_index: number } | undefined;
            if (chunk) {
              results.set(row.chunk_id, {
                path: chunk.path,
                content: chunk.content,
                score: similarity * this.vectorWeight,
                chunkIndex: chunk.chunk_index,
              });
            }
          }
        }
      } catch (err) {
        this.logger.debug("Vector search failed for docs", { domain, error: String(err) });
      }
    }

    return [...results.values()]
      .filter((r) => r.score >= 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({ domain, ...r }));
  }

  async searchAll(query: string, limit = 10): Promise<DocsSearchResult[]> {
    const allResults: DocsSearchResult[] = [];

    // Search loaded domains
    for (const domain of this.domains.keys()) {
      const results = await this.search(domain, query, limit);
      allResults.push(...results);
    }

    // Also check for unloaded domains on disk
    if (existsSync(this.baseDir)) {
      const files = readdirSync(this.baseDir).filter((f) => f.endsWith(".sqlite"));
      for (const file of files) {
        const domain = file.replace(".sqlite", "");
        if (!this.domains.has(domain)) {
          const results = await this.search(domain, query, limit);
          allResults.push(...results);
        }
      }
    }

    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  listDomains(): Array<{ domain: string; stats: { fileCount: number; chunkCount: number } }> {
    const result: Array<{ domain: string; stats: { fileCount: number; chunkCount: number } }> = [];

    // Include loaded domains
    for (const [domain, { db }] of this.domains) {
      const fileCount = (db.prepare("SELECT COUNT(DISTINCT path) AS c FROM chunks").get() as { c: number }).c;
      const chunkCount = (db.prepare("SELECT COUNT(*) AS c FROM chunks").get() as { c: number }).c;
      result.push({ domain, stats: { fileCount, chunkCount } });
    }

    // Include unloaded domains on disk
    if (existsSync(this.baseDir)) {
      const files = readdirSync(this.baseDir).filter((f) => f.endsWith(".sqlite"));
      for (const file of files) {
        const domain = file.replace(".sqlite", "");
        if (!this.domains.has(domain)) {
          result.push({ domain, stats: { fileCount: 0, chunkCount: 0 } });
        }
      }
    }

    return result;
  }

  async clearDomain(domain: string): Promise<void> {
    const domainDB = this.domains.get(domain);
    if (domainDB) {
      domainDB.db.close();
      this.domains.delete(domain);
    }
    const dbPath = join(this.baseDir, `${domain}.sqlite`);
    if (existsSync(dbPath)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(dbPath);
      // Also clean up WAL/SHM files
      try { unlinkSync(`${dbPath}-wal`); } catch { /* ignore */ }
      try { unlinkSync(`${dbPath}-shm`); } catch { /* ignore */ }
    }
    this.logger.info("Docs domain cleared", { domain });
  }

  close(): void {
    for (const [, { db }] of this.domains) {
      db.close();
    }
    this.domains.clear();
  }

  private async indexFile(db: import("better-sqlite3").Database, filePath: string): Promise<number> {
    if (!existsSync(filePath)) return 0;

    const content = readFileSync(filePath, "utf-8");
    const chunks = this.chunkContent(content, filePath);
    const now = Date.now();

    db.prepare("DELETE FROM chunks WHERE path = ?").run(filePath);

    const insert = db.prepare(
      "INSERT INTO chunks (path, chunk_index, content, updated_at) VALUES (?, ?, ?, ?)"
    );
    const insertMany = db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        insert.run(chunk.path, chunk.index, chunk.content, now);
      }
    });
    insertMany(chunks);

    if (this.embeddingProvider) {
      try {
        const texts = chunks.map((c) => c.content);
        const embeddings = await this.embeddingProvider.embedBatch(texts);
        const rows = db.prepare("SELECT id FROM chunks WHERE path = ? ORDER BY chunk_index")
          .all(filePath) as Array<{ id: number }>;

        const insertVec = db.prepare(
          "INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)"
        );
        const insertVecs = db.transaction(() => {
          for (let i = 0; i < rows.length && i < embeddings.length; i++) {
            const embBuf = new Uint8Array(new Float32Array(embeddings[i]).buffer);
            insertVec.run(rows[i].id, embBuf);
          }
        });
        insertVecs();
      } catch (err) {
        this.logger.warn("Failed to generate embeddings for docs file", { filePath, error: String(err) });
      }
    }

    return chunks.length;
  }

  private chunkContent(content: string, path: string): Chunk[] {
    const words = content.split(/\s+/);
    const chunks: Chunk[] = [];
    let i = 0;
    let index = 0;

    while (i < words.length) {
      const end = Math.min(i + this.chunkSize, words.length);
      const chunkText = words.slice(i, end).join(" ");
      chunks.push({ path, index, content: chunkText });
      i += this.chunkSize - this.chunkOverlap;
      index++;
    }

    return chunks;
  }

  private findFiles(dir: string): string[] {
    const files: string[] = [];
    const supportedExts = new Set([".md", ".txt", ".html", ".json", ".yaml", ".yml", ".rst", ".xml"]);
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...this.findFiles(fullPath));
      } else if (entry.isFile() && supportedExts.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
    return files;
  }
}
