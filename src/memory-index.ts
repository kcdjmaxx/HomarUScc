// CRC: crc-MemoryIndex.md | Seq: seq-memory-search.md
// Memory index with hybrid vector+FTS search — from HomarUS
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { watch, type FSWatcher } from "node:fs";
import type { Logger, MemoryConfig } from "./types.js";

export interface SearchResult {
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  paths?: string[];
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
}

interface Chunk {
  path: string;
  index: number;
  content: string;
}

// R82-R89: Temporal decay on search results
// R115-R117, R123: Dream-aware scoring
const DEFAULT_EVERGREEN_PATTERNS = ["MEMORY.md", "SOUL.md", "USER.md"];
const DEFAULT_DREAM_PATTERNS = ["dreams/"];
const MS_PER_DAY = 86_400_000;

export class MemoryIndex {
  private db: unknown = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private chunkSize: number;
  private chunkOverlap: number;
  private vectorWeight: number;
  private ftsWeight: number;
  private decayEnabled: boolean;
  private decayHalfLifeDays: number;
  private evergreenPatterns: string[];
  private dreamPatterns: string[];
  private dreamHalfLifeDays: number;
  private dreamBaseWeight: number;
  private mmrEnabled: boolean;
  private mmrLambda: number;
  private indexedPaths: string[] = [];
  private watcher: FSWatcher | null = null;
  private logger: Logger;
  private initialized = false;

  constructor(logger: Logger, options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    vectorWeight?: number;
    ftsWeight?: number;
    decayEnabled?: boolean;
    decayHalfLifeDays?: number;
    evergreenPatterns?: string[];
    dreamPatterns?: string[];
    dreamHalfLifeDays?: number;
    dreamBaseWeight?: number;
    mmrEnabled?: boolean;
    mmrLambda?: number;
  }) {
    this.logger = logger;
    this.chunkSize = options?.chunkSize ?? 400;
    this.chunkOverlap = options?.chunkOverlap ?? 80;
    this.vectorWeight = options?.vectorWeight ?? 0.7;
    this.ftsWeight = options?.ftsWeight ?? 0.3;
    this.decayEnabled = options?.decayEnabled ?? true;
    this.decayHalfLifeDays = options?.decayHalfLifeDays ?? 30;
    this.evergreenPatterns = options?.evergreenPatterns ?? DEFAULT_EVERGREEN_PATTERNS;
    this.dreamPatterns = options?.dreamPatterns ?? DEFAULT_DREAM_PATTERNS;
    this.dreamHalfLifeDays = options?.dreamHalfLifeDays ?? 7;
    this.dreamBaseWeight = options?.dreamBaseWeight ?? 0.5;
    this.mmrEnabled = options?.mmrEnabled ?? true;
    this.mmrLambda = options?.mmrLambda ?? 0.7;
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  // CRC: crc-MemoryIndex.md | R86
  setDecayConfig(config: NonNullable<MemoryConfig["decay"]>): void {
    if (config.enabled !== undefined) this.decayEnabled = config.enabled;
    if (config.halfLifeDays !== undefined) this.decayHalfLifeDays = config.halfLifeDays;
    if (config.evergreenPatterns !== undefined) this.evergreenPatterns = config.evergreenPatterns;
  }

  // CRC: crc-DreamScoring.md | R115, R116, R117, R123
  setDreamConfig(config: NonNullable<MemoryConfig["dreams"]>): void {
    if (config.halfLifeDays !== undefined) this.dreamHalfLifeDays = config.halfLifeDays;
    if (config.baseWeight !== undefined) this.dreamBaseWeight = config.baseWeight;
    if (config.patterns !== undefined) this.dreamPatterns = config.patterns;
  }

  // CRC: crc-MemoryIndex.md | R92, R93
  setSearchConfig(config: NonNullable<MemoryConfig["search"]>): void {
    if (config.vectorWeight !== undefined) this.vectorWeight = config.vectorWeight;
    if (config.ftsWeight !== undefined) this.ftsWeight = config.ftsWeight;
    if (config.mmrEnabled !== undefined) this.mmrEnabled = config.mmrEnabled;
    if (config.mmrLambda !== undefined) this.mmrLambda = config.mmrLambda;
  }

  async initialize(dbPath: string): Promise<void> {
    const Database = (await import("better-sqlite3")).default;
    this.db = new Database(dbPath);
    const db = this.db as import("better-sqlite3").Database;

    db.pragma("journal_mode = WAL");

    try {
      const sqliteVec = await import("sqlite-vec");
      (sqliteVec as { load: (db: unknown) => void }).load(db);
    } catch {
      this.logger.warn("sqlite-vec not available, vector search disabled");
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
      this.logger.debug("Vector table creation skipped");
    }

    this.initialized = true;
    this.logger.info("Memory index initialized", { dbPath });
  }

  async indexFile(path: string): Promise<void> {
    if (!this.initialized || !this.db) return;
    if (!existsSync(path)) return;

    const content = readFileSync(path, "utf-8");
    const chunks = this.chunkContent(content, path);
    const db = this.db as import("better-sqlite3").Database;
    const now = Date.now();

    db.prepare("DELETE FROM chunks WHERE path = ?").run(path);

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
        const rows = db.prepare("SELECT id FROM chunks WHERE path = ? ORDER BY chunk_index").all(path) as Array<{ id: number }>;

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
        this.logger.warn("Failed to generate embeddings", { path, error: String(err) });
      }
    }

    this.logger.debug("Indexed file", { path, chunks: chunks.length });
  }

  async indexDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;
    const files = this.findMarkdownFiles(dirPath);
    for (const file of files) {
      await this.indexFile(file);
    }
    if (!this.indexedPaths.includes(dirPath)) {
      this.indexedPaths.push(dirPath);
    }
    this.logger.info("Indexed directory", { path: dirPath, files: files.length });
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.initialized || !this.db) return [];

    const db = this.db as import("better-sqlite3").Database;
    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0.1;
    const results = new Map<number, { path: string; content: string; score: number; chunkIndex: number; updatedAt: number }>();

    try {
      const ftsResults = db.prepare(`
        SELECT c.id, c.path, c.content, c.chunk_index, c.updated_at,
               bm25(chunks_fts) AS rank
        FROM chunks_fts f
        JOIN chunks c ON c.id = f.rowid
        WHERE chunks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit * 2) as Array<{
        id: number; path: string; content: string; chunk_index: number; updated_at: number; rank: number;
      }>;

      const maxRank = ftsResults.length > 0 ? Math.max(...ftsResults.map((r) => Math.abs(r.rank))) : 1;
      for (const row of ftsResults) {
        const normalizedScore = maxRank > 0 ? Math.abs(row.rank) / maxRank : 0;
        results.set(row.id, {
          path: row.path,
          content: row.content,
          score: normalizedScore * this.ftsWeight,
          chunkIndex: row.chunk_index,
          updatedAt: row.updated_at,
        });
      }
    } catch {
      // FTS query may fail on certain inputs
    }

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
            const chunk = db.prepare("SELECT path, content, chunk_index, updated_at FROM chunks WHERE id = ?")
              .get(row.chunk_id) as { path: string; content: string; chunk_index: number; updated_at: number } | undefined;
            if (chunk) {
              results.set(row.chunk_id, {
                path: chunk.path,
                content: chunk.content,
                score: similarity * this.vectorWeight,
                chunkIndex: chunk.chunk_index,
                updatedAt: chunk.updated_at,
              });
            }
          }
        }
      } catch (err) {
        this.logger.debug("Vector search failed", { error: String(err) });
      }
    }

    // CRC: crc-MemoryIndex.md | R82, R87
    if (this.decayEnabled) {
      for (const result of results.values()) {
        result.score *= this.computeDecay(result.updatedAt, result.path);
      }
    }

    // CRC: crc-DreamScoring.md | R115
    for (const result of results.values()) {
      if (this.isDreamContent(result.path)) {
        result.score *= this.dreamBaseWeight;
      }
    }

    const candidates = [...results.entries()]
      .filter(([, r]) => r.score >= minScore)
      .sort(([, a], [, b]) => b.score - a.score);

    // CRC: crc-MemoryIndex.md | R90, R96
    if (this.mmrEnabled && candidates.length > 1) {
      return this.mmrRerank(candidates, limit, db);
    }

    return candidates.slice(0, limit).map(([, r]) => r);
  }

  get(path: string): string | undefined {
    if (!existsSync(path)) return undefined;
    return readFileSync(path, "utf-8");
  }

  async store(content: string, path: string): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, content);
    await this.indexFile(path);
  }

  startWatching(): void {
    if (this.watcher) return;
    for (const dir of this.indexedPaths) {
      this.watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith(".md")) return;
        const fullPath = join(dir, filename);
        this.indexFile(fullPath).catch((err) => {
          this.logger.warn("Reindex failed", { path: fullPath, error: String(err) });
        });
      });
    }
  }

  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  getRecentPaths(limit = 10): string[] {
    if (!this.initialized || !this.db) return [];
    const db = this.db as import("better-sqlite3").Database;
    const rows = db.prepare(
      "SELECT DISTINCT path FROM chunks ORDER BY updated_at DESC LIMIT ?"
    ).all(limit) as Array<{ path: string }>;
    return rows.map((r) => r.path);
  }

  getStats(): { fileCount: number; chunkCount: number; indexedPaths: string[] } {
    if (!this.initialized || !this.db) {
      return { fileCount: 0, chunkCount: 0, indexedPaths: this.indexedPaths };
    }
    const db = this.db as import("better-sqlite3").Database;
    const fileCount = (db.prepare("SELECT COUNT(DISTINCT path) AS c FROM chunks").get() as { c: number }).c;
    const chunkCount = (db.prepare("SELECT COUNT(*) AS c FROM chunks").get() as { c: number }).c;
    return { fileCount, chunkCount, indexedPaths: this.indexedPaths };
  }

  // CRC: crc-MemoryIndex.md | R90, R91
  private mmrRerank(
    candidates: Array<[number, { path: string; content: string; score: number; chunkIndex: number; updatedAt: number }]>,
    limit: number,
    db: import("better-sqlite3").Database,
  ): SearchResult[] {
    const selected: Array<{ id: number; path: string; content: string; score: number; chunkIndex: number }> = [];
    const remaining = new Map(candidates);

    // Pre-fetch embeddings for MMR similarity if available
    const embeddingCache = new Map<number, Float32Array>();
    if (this.embeddingProvider) {
      try {
        for (const [id] of candidates) {
          const row = db.prepare("SELECT embedding FROM chunks_vec WHERE chunk_id = ?").get(id) as { embedding: Buffer } | undefined;
          if (row) {
            embeddingCache.set(id, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
          }
        }
      } catch {
        // Vector table may not exist
      }
    }

    while (selected.length < limit && remaining.size > 0) {
      let bestId = -1;
      let bestMmrScore = -Infinity;

      for (const [id, candidate] of remaining) {
        const relevance = candidate.score;
        let maxSim = 0;

        for (const sel of selected) {
          const sim = this.chunkSimilarity(id, sel.id, candidate.content, sel.content, embeddingCache);
          if (sim > maxSim) maxSim = sim;
        }

        const mmrScore = this.mmrLambda * relevance - (1 - this.mmrLambda) * maxSim;
        if (mmrScore > bestMmrScore) {
          bestMmrScore = mmrScore;
          bestId = id;
        }
      }

      if (bestId === -1) break;
      const best = remaining.get(bestId)!;
      selected.push({ id: bestId, ...best });
      remaining.delete(bestId);
    }

    return selected.map(({ path, content, score, chunkIndex }) => ({ path, content, score, chunkIndex }));
  }

  // CRC: crc-MemoryIndex.md | R94, R95
  private chunkSimilarity(
    idA: number, idB: number,
    contentA: string, contentB: string,
    embeddingCache: Map<number, Float32Array>,
  ): number {
    const embA = embeddingCache.get(idA);
    const embB = embeddingCache.get(idB);
    if (embA && embB) return this.cosineSimilarity(embA, embB);
    return this.jaccardSimilarity(contentA, contentB);
  }

  // CRC: crc-MemoryIndex.md | R94
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  // CRC: crc-MemoryIndex.md | R95
  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  // CRC: crc-MemoryIndex.md | R82, R83 | crc-DreamScoring.md | R116
  private computeDecay(updatedAt: number, path: string): number {
    if (!updatedAt || this.isEvergreen(path)) return 1.0;
    const ageDays = (Date.now() - updatedAt) / MS_PER_DAY;
    if (ageDays <= 0) return 1.0;
    const halfLife = this.isDreamContent(path) ? this.dreamHalfLifeDays : this.decayHalfLifeDays;
    return Math.pow(0.5, ageDays / halfLife);
  }

  // CRC: crc-MemoryIndex.md | R84, R85, R88
  private isEvergreen(path: string): boolean {
    return this.evergreenPatterns.some((pattern) => path.endsWith(pattern));
  }

  // CRC: crc-DreamScoring.md | R117
  private isDreamContent(path: string): boolean {
    return this.dreamPatterns.some((pattern) => path.includes(pattern));
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

  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        files.push(...this.findMarkdownFiles(fullPath));
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        files.push(fullPath);
      }
    }
    return files;
  }
}
