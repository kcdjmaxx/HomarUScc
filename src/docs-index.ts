// DocsIndex — generic domain-specific vector DB for documentation
// Reuses the same embedding pipeline as MemoryIndex but with separate DBs per domain
// No temporal decay, no dream scoring — pure reference lookup
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { createRequire } from "node:module";
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

    // Include unloaded domains on disk — peek at sqlite to get real counts
    if (existsSync(this.baseDir)) {
      const files = readdirSync(this.baseDir).filter((f) => f.endsWith(".sqlite"));
      for (const file of files) {
        const domain = file.replace(".sqlite", "");
        if (!this.domains.has(domain)) {
          try {
            const req = createRequire(import.meta.url);
            const Database = req("better-sqlite3");
            const dbPath = join(this.baseDir, file);
            const peekDb = new Database(dbPath, { readonly: true });
            const fileCount = (peekDb.prepare("SELECT COUNT(DISTINCT path) AS c FROM chunks").get() as { c: number }).c;
            const chunkCount = (peekDb.prepare("SELECT COUNT(*) AS c FROM chunks").get() as { c: number }).c;
            peekDb.close();
            result.push({ domain, stats: { fileCount, chunkCount } });
          } catch {
            result.push({ domain, stats: { fileCount: 0, chunkCount: 0 } });
          }
        }
      }
    }

    return result;
  }

  async clearCompiled(domain: string): Promise<number> {
    const domainDB = this.domains.get(domain);
    if (!domainDB) return 0;
    const { db } = domainDB;
    // Get IDs of compiled chunks for vector cleanup
    const compiledIds = db.prepare("SELECT id FROM chunks WHERE path LIKE 'compiled/%'").all() as Array<{ id: number }>;
    for (const { id } of compiledIds) {
      try { db.prepare("DELETE FROM chunks_vec WHERE chunk_id = ?").run(id); } catch { /* ignore */ }
    }
    const result = db.prepare("DELETE FROM chunks WHERE path LIKE 'compiled/%'").run();
    this.logger.info("Cleared compiled articles", { domain, deleted: result.changes });
    return result.changes;
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

  async compile(domain: string, options?: {
    clusterThreshold?: number;
    maxClustersPerBatch?: number;
    model?: string;
  }): Promise<{ clustersFound: number; articlesGenerated: number; chunksCreated: number }> {
    const domainDB = this.domains.get(domain);
    if (!domainDB) {
      const dbPath = join(this.baseDir, `${domain}.sqlite`);
      if (!existsSync(dbPath)) throw new Error(`Domain "${domain}" not found`);
      await this.getOrCreateDomain(domain);
      return this.compile(domain, options);
    }

    const { db } = domainDB;
    const threshold = options?.clusterThreshold ?? 0.85;
    const maxClusters = options?.maxClustersPerBatch ?? 20;
    const model = options?.model ?? "claude-haiku-4-5-20251001";
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — needed for synthesis");

    // 1. Get all chunks and their embeddings
    const allChunks = db.prepare(
      "SELECT c.id, c.path, c.chunk_index, c.content FROM chunks c WHERE c.path NOT LIKE '%compiled/%' ORDER BY c.path, c.chunk_index"
    ).all() as Array<{ id: number; path: string; chunk_index: number; content: string }>;

    if (allChunks.length === 0) throw new Error(`Domain "${domain}" has no chunks to compile`);

    // Get embeddings from vector table
    const embMap = new Map<number, Float32Array>();
    if (this.embeddingProvider) {
      const vecRows = db.prepare(
        "SELECT chunk_id, embedding FROM chunks_vec"
      ).all() as Array<{ chunk_id: number; embedding: Buffer }>;
      for (const row of vecRows) {
        embMap.set(row.chunk_id, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
      }
    }

    // 2. Cluster by source file first, then merge similar clusters
    // Step A: Group chunks by source file
    const fileGroups = new Map<string, typeof allChunks>();
    for (const chunk of allChunks) {
      const key = chunk.path;
      if (!fileGroups.has(key)) fileGroups.set(key, []);
      fileGroups.get(key)!.push(chunk);
    }

    // Step B: Compute centroid embedding for each file group
    const groupEntries = [...fileGroups.entries()];
    const centroids = new Map<string, Float32Array>();
    for (const [path, chunks] of groupEntries) {
      const embs = chunks.map(c => embMap.get(c.id)).filter(Boolean) as Float32Array[];
      if (embs.length === 0) continue;
      const dims = embs[0].length;
      const centroid = new Float32Array(dims);
      for (const emb of embs) {
        for (let d = 0; d < dims; d++) centroid[d] += emb[d];
      }
      for (let d = 0; d < dims; d++) centroid[d] /= embs.length;
      centroids.set(path, centroid);
    }

    // Step C: Merge file groups with similar centroids
    const mergedClusters: Array<typeof allChunks> = [];
    const mergedPaths = new Set<string>();

    for (const [path, chunks] of groupEntries) {
      if (mergedPaths.has(path)) continue;
      if (mergedClusters.length >= maxClusters) break;

      const cluster = [...chunks];
      mergedPaths.add(path);
      const seedCentroid = centroids.get(path);

      if (seedCentroid) {
        for (const [otherPath, otherChunks] of groupEntries) {
          if (mergedPaths.has(otherPath)) continue;
          const otherCentroid = centroids.get(otherPath);
          if (!otherCentroid) continue;
          const sim = this.cosineSimilarity(seedCentroid, otherCentroid);
          if (sim >= threshold) {
            cluster.push(...otherChunks);
            mergedPaths.add(otherPath);
          }
        }
      }

      mergedClusters.push(cluster);
    }

    // Add remaining unmerged file groups
    for (const [path, chunks] of groupEntries) {
      if (!mergedPaths.has(path)) {
        mergedClusters.push(chunks);
        mergedPaths.add(path);
      }
    }

    const largeClusters = mergedClusters;

    this.logger.info("Docs compile: clusters formed", { domain, clusters: largeClusters.length, totalChunks: allChunks.length });

    // 3. Synthesize concept articles via LLM
    let totalArticlesCreated = 0;
    let totalChunksCreated = 0;

    // Get all concept titles first for cross-referencing
    const clusterSummaries = largeClusters.map((cluster, i) => {
      const sources = [...new Set(cluster.map(c => c.path))];
      const preview = cluster.slice(0, 3).map(c => c.content.slice(0, 100)).join(" | ");
      return { index: i, sources, preview, chunkCount: cluster.length };
    });

    for (let i = 0; i < largeClusters.length; i++) {
      const cluster = largeClusters[i];
      const combinedContent = cluster.map(c => c.content).join("\n\n---\n\n");
      const sources = [...new Set(cluster.map(c => c.path))];

      // Build cross-reference context
      const otherTopics = clusterSummaries
        .filter((_, j) => j !== i)
        .map(s => s.preview.slice(0, 60))
        .slice(0, 10)
        .join(", ");

      const prompt = `You are synthesizing documentation fragments into a concept article.

DOMAIN: ${domain}
SOURCE FILES: ${sources.join(", ")}

FRAGMENTS (${cluster.length} chunks):
${combinedContent.slice(0, 8000)}

OTHER TOPICS IN THIS DOMAIN (for cross-referencing):
${otherTopics}

Write a concise markdown concept article that:
1. Synthesizes the key information from these fragments into a coherent article
2. Uses a clear title as the first line (# Title)
3. Organizes information logically with subheadings
4. Includes cross-references to related concepts where relevant (use markdown links like [concept name])
5. Preserves technical accuracy — don't invent information not in the fragments
6. Cites source files where appropriate

Keep it focused and information-dense. No filler.`;

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) {
          this.logger.warn("Compile LLM call failed", { domain, cluster: i, status: response.status });
          continue;
        }

        const data = await response.json() as {
          content: Array<{ type: string; text?: string }>;
        };
        const articleText = data.content?.[0]?.text ?? "";
        if (!articleText) continue;

        // Extract title from the article for the key
        const titleMatch = articleText.match(/^#\s+(.+)/m);
        const title = titleMatch?.[1] ?? `concept-${i}`;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const key = `compiled/${slug}`;

        // Store back into the domain via ingestText
        const result = await this.ingestText(domain, key, articleText);
        totalArticlesCreated++;
        totalChunksCreated += result.chunksCreated;

        this.logger.debug("Compiled article", { domain, title, chunks: result.chunksCreated });
      } catch (err) {
        this.logger.warn("Compile article failed", { domain, cluster: i, error: String(err) });
      }
    }

    this.logger.info("Docs compile complete", { domain, articles: totalArticlesCreated, chunks: totalChunksCreated });
    return { clustersFound: largeClusters.length, articlesGenerated: totalArticlesCreated, chunksCreated: totalChunksCreated };
  }

  async getClusters(domain: string, options?: {
    clusterThreshold?: number;
    maxClusters?: number;
  }): Promise<Array<{ index: number; sources: string[]; chunkCount: number; content: string }>> {
    const domainDB = this.domains.get(domain);
    if (!domainDB) {
      const dbPath = join(this.baseDir, `${domain}.sqlite`);
      if (!existsSync(dbPath)) throw new Error(`Domain "${domain}" not found`);
      await this.getOrCreateDomain(domain);
      return this.getClusters(domain, options);
    }

    const { db } = domainDB;
    const threshold = options?.clusterThreshold ?? 0.85;
    const maxClusters = options?.maxClusters ?? 20;

    const allChunks = db.prepare(
      "SELECT c.id, c.path, c.chunk_index, c.content FROM chunks c WHERE c.path NOT LIKE '%compiled/%' ORDER BY c.path, c.chunk_index"
    ).all() as Array<{ id: number; path: string; chunk_index: number; content: string }>;

    if (allChunks.length === 0) return [];

    const embMap = new Map<number, Float32Array>();
    if (this.embeddingProvider) {
      const vecRows = db.prepare("SELECT chunk_id, embedding FROM chunks_vec").all() as Array<{ chunk_id: number; embedding: Buffer }>;
      for (const row of vecRows) {
        embMap.set(row.chunk_id, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
      }
    }

    // Cluster by source file, then merge similar
    const fileGroups = new Map<string, typeof allChunks>();
    for (const chunk of allChunks) {
      if (!fileGroups.has(chunk.path)) fileGroups.set(chunk.path, []);
      fileGroups.get(chunk.path)!.push(chunk);
    }

    const groupEntries = [...fileGroups.entries()];
    const centroids = new Map<string, Float32Array>();
    for (const [path, chunks] of groupEntries) {
      const embs = chunks.map(c => embMap.get(c.id)).filter(Boolean) as Float32Array[];
      if (embs.length === 0) continue;
      const dims = embs[0].length;
      const centroid = new Float32Array(dims);
      for (const emb of embs) { for (let d = 0; d < dims; d++) centroid[d] += emb[d]; }
      for (let d = 0; d < dims; d++) centroid[d] /= embs.length;
      centroids.set(path, centroid);
    }

    const clusters: Array<typeof allChunks> = [];
    const mergedPaths = new Set<string>();
    for (const [path, chunks] of groupEntries) {
      if (mergedPaths.has(path) || clusters.length >= maxClusters) continue;
      const cluster = [...chunks];
      mergedPaths.add(path);
      const seedCentroid = centroids.get(path);
      if (seedCentroid) {
        for (const [otherPath, otherChunks] of groupEntries) {
          if (mergedPaths.has(otherPath)) continue;
          const otherCentroid = centroids.get(otherPath);
          if (!otherCentroid) continue;
          if (this.cosineSimilarity(seedCentroid, otherCentroid) >= threshold) {
            cluster.push(...otherChunks);
            mergedPaths.add(otherPath);
          }
        }
      }
      clusters.push(cluster);
    }
    // Add remaining unmerged paths, but respect maxClusters cap
    for (const [path, chunks] of groupEntries) {
      if (!mergedPaths.has(path)) {
        if (clusters.length < maxClusters) {
          clusters.push(chunks);
        } else {
          // Merge into the most similar existing cluster
          const orphanCentroid = centroids.get(path);
          if (orphanCentroid) {
            let bestIdx = clusters.length - 1;
            let bestSim = -1;
            for (let ci = 0; ci < clusters.length; ci++) {
              const clusterPaths = [...new Set(clusters[ci].map(c => c.path))];
              for (const cp of clusterPaths) {
                const cc = centroids.get(cp);
                if (cc) {
                  const sim = this.cosineSimilarity(orphanCentroid, cc);
                  if (sim > bestSim) { bestSim = sim; bestIdx = ci; }
                }
              }
            }
            clusters[bestIdx].push(...chunks);
          } else {
            clusters[clusters.length - 1].push(...chunks);
          }
        }
        mergedPaths.add(path);
      }
    }

    return clusters.map((cluster, i) => ({
      index: i,
      sources: [...new Set(cluster.map(c => c.path))],
      chunkCount: cluster.length,
      content: cluster.map(c => c.content).join("\n\n---\n\n").slice(0, 8000),
    }));
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom > 0 ? dot / denom : 0;
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
