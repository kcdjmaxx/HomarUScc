// CRC: local/vault-indexer/design/crc-VaultIndex.md | Seq: local/vault-indexer/design/seq-full-reindex.md
// VaultIndex — indexes an Obsidian vault into a dedicated SQLite vector DB
// Requirements: V1-V21, V35, V40-V42
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import type { Logger, EmbeddingProvider } from "./types.js";

export interface VaultSearchResult {
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface ReindexStats {
  filesProcessed: number;
  chunksCreated: number;
  durationMs: number;
  errors?: number;
}

interface VaultChunk {
  path: string;
  index: number;
  content: string;
}

export interface VaultIndexOptions {
  vaultPath: string;
  exclusions?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
  vectorWeight?: number;
  ftsWeight?: number;
  // Substrings (matched against full path) where .html files should also be
  // indexed. Default: empty (md-only). Use to opt-in specific subtrees like the
  // Fric & Frac Website v2 mirror without flooding the index with every dashboard
  // and report HTML in the vault.
  htmlSubpaths?: string[];
}

const DEFAULT_EXCLUSIONS = [
  ".obsidian", "node_modules", "venv", ".git", "dist", ".stversions", ".claude",
];

export class VaultIndex {
  private db: unknown = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private vaultPath: string;
  private exclusions: string[];
  private htmlSubpaths: string[];
  private chunkSize: number;
  private chunkOverlap: number;
  private vectorWeight: number;
  private ftsWeight: number;
  private logger: Logger;
  private initialized = false;

  constructor(logger: Logger, options: VaultIndexOptions) {
    this.logger = logger;
    this.vaultPath = options.vaultPath;
    this.exclusions = options.exclusions ?? DEFAULT_EXCLUSIONS;
    this.htmlSubpaths = options.htmlSubpaths ?? [];
    this.chunkSize = options.chunkSize ?? 400;
    this.chunkOverlap = options.chunkOverlap ?? 80;
    this.vectorWeight = options.vectorWeight ?? 0.7;
    this.ftsWeight = options.ftsWeight ?? 0.3;
  }

  // V2: Reuse shared EmbeddingProvider
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  // V1, V4, V5, V40, V41: Initialize SQLite DB with all tables
  async initialize(dbPath: string): Promise<void> {
    // V40: Create directory if needed
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const Database = (await import("better-sqlite3")).default;
    this.db = new Database(dbPath);
    const db = this.db as import("better-sqlite3").Database;

    db.pragma("journal_mode = WAL");

    try {
      const sqliteVec = await import("sqlite-vec");
      (sqliteVec as { load: (db: unknown) => void }).load(db);
    } catch {
      this.logger.warn("sqlite-vec not available for vault index, vector search disabled");
    }

    // V3: Chunks table with file_mtime
    db.exec(`
      CREATE TABLE IF NOT EXISTS vault_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        file_mtime INTEGER NOT NULL,
        UNIQUE(file_path, chunk_index)
      );
      CREATE INDEX IF NOT EXISTS idx_vault_chunks_path ON vault_chunks(file_path);
    `);

    // V12: Files metadata table for mtime tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS vault_files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        indexed_at INTEGER NOT NULL
      );
    `);

    // V4: FTS5 virtual table with triggers
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vault_fts USING fts5(
        content, content='vault_chunks', content_rowid='id'
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS vault_chunks_ai AFTER INSERT ON vault_chunks BEGIN
        INSERT INTO vault_fts(rowid, content) VALUES (new.id, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS vault_chunks_ad AFTER DELETE ON vault_chunks BEGIN
        INSERT INTO vault_fts(vault_fts, rowid, content) VALUES('delete', old.id, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS vault_chunks_au AFTER UPDATE ON vault_chunks BEGIN
        INSERT INTO vault_fts(vault_fts, rowid, content) VALUES('delete', old.id, old.content);
        INSERT INTO vault_fts(rowid, content) VALUES (new.id, new.content);
      END;
    `);

    // V5: vec0 virtual table
    try {
      const dims = this.embeddingProvider?.dimensions() ?? 768;
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vault_vec USING vec0(
          chunk_id INTEGER PRIMARY KEY,
          embedding float[${dims}]
        );
      `);
    } catch {
      this.logger.debug("Vault vector table creation skipped");
    }

    this.initialized = true;
    this.logger.info("Vault index initialized", { dbPath, vaultPath: this.vaultPath });
  }

  // V7, V8, V9, V10, V11, V12, V13: Full reindex — clean slate
  async fullReindex(): Promise<ReindexStats> {
    if (!this.initialized || !this.db) {
      throw new Error("VaultIndex not initialized");
    }

    const startTime = Date.now();
    const db = this.db as import("better-sqlite3").Database;

    // V9: Drop all existing data
    db.exec("DELETE FROM vault_chunks");
    db.exec("DELETE FROM vault_files");
    // Rebuild FTS index after deleting all content
    db.exec("INSERT INTO vault_fts(vault_fts) VALUES('rebuild')");
    try {
      db.exec("DELETE FROM vault_vec");
    } catch {
      // vec table may not exist
    }

    // V7, V8: Scan all .md files
    const files = this.scanFiles();
    this.logger.info(`Vault full reindex: found ${files.length} markdown files`);

    let chunksCreated = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const filePath = files[i];
        const stat = statSync(filePath);
        const mtime = stat.mtimeMs;
        const count = await this.indexFile(filePath, mtime);
        chunksCreated += count;

        // V42: Log progress every 50 files
        if ((i + 1) % 50 === 0) {
          this.logger.info(`Vault reindex progress: ${i + 1}/${files.length} files, ${chunksCreated} chunks`);
        }
      } catch (err) {
        errors++;
        this.logger.warn("Failed to index vault file", { path: files[i], error: String(err) });
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.info("Vault full reindex complete", {
      filesProcessed: files.length, chunksCreated, durationMs, errors,
    });

    return { filesProcessed: files.length, chunksCreated, durationMs, errors };
  }

  // V14, V15, V16, V17: Incremental reindex
  async incrementalReindex(): Promise<ReindexStats> {
    if (!this.initialized || !this.db) {
      throw new Error("VaultIndex not initialized");
    }

    const startTime = Date.now();
    const db = this.db as import("better-sqlite3").Database;

    // Get current files on disk
    const diskFiles = this.scanFiles();
    const diskFileSet = new Set(diskFiles);

    // Get stored file mtimes
    const storedFiles = db.prepare("SELECT path, mtime FROM vault_files").all() as Array<{ path: string; mtime: number }>;
    const storedMap = new Map(storedFiles.map((f) => [f.path, f.mtime]));

    // V16: Remove files that no longer exist
    for (const [storedPath] of storedMap) {
      if (!diskFileSet.has(storedPath)) {
        db.prepare("DELETE FROM vault_chunks WHERE file_path = ?").run(storedPath);
        db.prepare("DELETE FROM vault_files WHERE path = ?").run(storedPath);
        this.logger.debug("Removed deleted vault file from index", { path: storedPath });
      }
    }

    // V14, V15: Index new or changed files
    let filesProcessed = 0;
    let chunksCreated = 0;
    let errors = 0;

    for (const filePath of diskFiles) {
      try {
        const stat = statSync(filePath);
        const mtime = stat.mtimeMs;
        const storedMtime = storedMap.get(filePath);

        if (storedMtime !== undefined && Math.abs(storedMtime - mtime) < 1) {
          continue; // File unchanged
        }

        // Delete old chunks for this file before re-indexing
        db.prepare("DELETE FROM vault_chunks WHERE file_path = ?").run(filePath);
        try {
          // Also remove old vec entries for this file's chunks
          const oldIds = db.prepare("SELECT id FROM vault_chunks WHERE file_path = ?").all(filePath) as Array<{ id: number }>;
          for (const row of oldIds) {
            try { db.prepare("DELETE FROM vault_vec WHERE chunk_id = ?").run(row.id); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        db.prepare("DELETE FROM vault_files WHERE path = ?").run(filePath);

        const count = await this.indexFile(filePath, mtime);
        chunksCreated += count;
        filesProcessed++;

        if (filesProcessed % 50 === 0) {
          this.logger.info(`Vault incremental reindex progress: ${filesProcessed} files updated, ${chunksCreated} chunks`);
        }
      } catch (err) {
        errors++;
        this.logger.warn("Failed to index vault file", { path: filePath, error: String(err) });
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.info("Vault incremental reindex complete", {
      filesProcessed, chunksCreated, durationMs, errors,
    });

    return { filesProcessed, chunksCreated, durationMs, errors };
  }

  // V18, V19, V20, V21: Hybrid vector+FTS search, no temporal decay
  async search(query: string, options?: { limit?: number; minScore?: number }): Promise<VaultSearchResult[]> {
    if (!this.initialized || !this.db) return [];

    const db = this.db as import("better-sqlite3").Database;
    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0.1;
    const results = new Map<number, { path: string; content: string; score: number; chunkIndex: number }>();

    // FTS search
    try {
      const ftsResults = db.prepare(`
        SELECT c.id, c.file_path, c.content, c.chunk_index,
               bm25(vault_fts) AS rank
        FROM vault_fts f
        JOIN vault_chunks c ON c.id = f.rowid
        WHERE vault_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit * 2) as Array<{
        id: number; file_path: string; content: string; chunk_index: number; rank: number;
      }>;

      const maxRank = ftsResults.length > 0 ? Math.max(...ftsResults.map((r) => Math.abs(r.rank))) : 1;
      for (const row of ftsResults) {
        const normalizedScore = maxRank > 0 ? Math.abs(row.rank) / maxRank : 0;
        results.set(row.id, {
          path: this.relativePath(row.file_path), // V20
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
          FROM vault_vec
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
            const chunk = db.prepare("SELECT file_path, content, chunk_index FROM vault_chunks WHERE id = ?")
              .get(row.chunk_id) as { file_path: string; content: string; chunk_index: number } | undefined;
            if (chunk) {
              results.set(row.chunk_id, {
                path: this.relativePath(chunk.file_path), // V20
                content: chunk.content,
                score: similarity * this.vectorWeight,
                chunkIndex: chunk.chunk_index,
              });
            }
          }
        }
      } catch (err) {
        this.logger.debug("Vault vector search failed", { error: String(err) });
      }
    }

    // V19: No temporal decay — vault content is reference material

    return [...results.entries()]
      .filter(([, r]) => r.score >= minScore)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, limit)
      .map(([, r]) => r);
  }

  getStats(): { fileCount: number; chunkCount: number } {
    if (!this.initialized || !this.db) {
      return { fileCount: 0, chunkCount: 0 };
    }
    const db = this.db as import("better-sqlite3").Database;
    const fileCount = (db.prepare("SELECT COUNT(*) AS c FROM vault_files").get() as { c: number }).c;
    const chunkCount = (db.prepare("SELECT COUNT(*) AS c FROM vault_chunks").get() as { c: number }).c;
    return { fileCount, chunkCount };
  }

  // Check if a given absolute path exists in the vault index
  hasFile(absolutePath: string): boolean {
    if (!this.initialized || !this.db) return false;
    const db = this.db as import("better-sqlite3").Database;
    const row = db.prepare("SELECT 1 FROM vault_files WHERE path = ?").get(absolutePath);
    return !!row;
  }

  close(): void {
    if (this.db) {
      (this.db as import("better-sqlite3").Database).close();
      this.db = null;
      this.initialized = false;
    }
  }

  // V7, V8, V35: Recursively scan vault for .md files
  private scanFiles(): string[] {
    const files: string[] = [];
    this.walkDir(this.vaultPath, files);
    return files;
  }

  private walkDir(dir: string, files: string[]): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // V8: Skip exclusion patterns
        if (this.exclusions.some((excl) => entry.name === excl || entry.name === excl.replace(/\/$/, ""))) {
          continue;
        }
        this.walkDir(fullPath, files);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (ext === ".md") {
          files.push(fullPath);
        } else if (ext === ".html" && this.htmlSubpaths.some(sub => fullPath.includes(sub))) {
          // Opt-in HTML inclusion for select subpaths (e.g. F&F site mirror)
          files.push(fullPath);
        }
      }
    }
  }

  // V10: Word-based chunking
  private chunkContent(content: string, path: string): VaultChunk[] {
    const words = content.split(/\s+/);
    const chunks: VaultChunk[] = [];
    let i = 0;
    let index = 0;

    while (i < words.length) {
      const end = Math.min(i + this.chunkSize, words.length);
      const chunkText = words.slice(i, end).join(" ");
      if (chunkText.trim()) {
        chunks.push({ path, index, content: chunkText });
      }
      i += this.chunkSize - this.chunkOverlap;
      index++;
    }

    return chunks;
  }

  // V6, V11, V12: Index a single file — chunks, embeds, stores
  private async indexFile(filePath: string, mtime: number): Promise<number> {
    if (!this.db) return 0;

    const content = readFileSync(filePath, "utf-8");
    const chunks = this.chunkContent(content, filePath);
    const db = this.db as import("better-sqlite3").Database;
    const now = Date.now();

    const insert = db.prepare(
      "INSERT INTO vault_chunks (file_path, chunk_index, content, updated_at, file_mtime) VALUES (?, ?, ?, ?, ?)"
    );

    const insertMany = db.transaction((items: VaultChunk[]) => {
      for (const chunk of items) {
        insert.run(chunk.path, chunk.index, chunk.content, now, mtime);
      }
    });
    insertMany(chunks);

    // V11: Generate embeddings
    if (this.embeddingProvider && chunks.length > 0) {
      try {
        const texts = chunks.map((c) => c.content);
        const embeddings = await this.embeddingProvider.embedBatch(texts);
        const rows = db.prepare(
          "SELECT id FROM vault_chunks WHERE file_path = ? ORDER BY chunk_index"
        ).all(filePath) as Array<{ id: number }>;

        // V6: sqlite-vec quirk — Uint8Array for embeddings, CAST for chunk_id
        const insertVec = db.prepare(
          "INSERT OR REPLACE INTO vault_vec (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)"
        );
        const insertVecs = db.transaction(() => {
          for (let i = 0; i < rows.length && i < embeddings.length; i++) {
            const embBuf = new Uint8Array(new Float32Array(embeddings[i]).buffer);
            insertVec.run(rows[i].id, embBuf);
          }
        });
        insertVecs();
      } catch (err) {
        this.logger.warn("Failed to generate vault embeddings", { path: filePath, error: String(err) });
      }
    }

    // V12: Record file metadata
    db.prepare(
      "INSERT OR REPLACE INTO vault_files (path, mtime, chunk_count, indexed_at) VALUES (?, ?, ?, ?)"
    ).run(filePath, mtime, chunks.length, now);

    return chunks.length;
  }

  // V20: Strip vault path prefix for display
  private relativePath(fullPath: string): string {
    return relative(this.vaultPath, fullPath);
  }
}
