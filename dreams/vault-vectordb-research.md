# Vault Vector Database — Research & Architecture Proposal

Date: 2026-02-25
Author: Caul (research agent)

---

## 1. Vault Survey

### Size & Shape

| Metric | Value |
|--------|-------|
| Total .md files (excluding node_modules, venv, .obsidian, .claude) | 786 |
| Total bytes | ~4.9 MB |
| Total words | ~744,000 |
| Estimated chunks (400-word, 80-word overlap) | ~2,326 |
| Files with YAML frontmatter tags | 231 (29%) |
| Mean file size | ~1,893 words |
| Median file size | ~345 words |

### Top-Level Directory Distribution

| Directory | Files | Notes |
|-----------|-------|-------|
| ClawdBot/ | 431 | Agent infra, HalShare transcripts, openclaw-kanban, homaruscc |
| MaxxConnect/ | 95 | Flask email/SMS marketing platform (was mailChimpClone) |
| Duet_llm/ | 92 | Multi-agent LLM conversation logs and persona files |
| resist/ | 26 | Unknown project |
| frictionless/ | 25 | Unknown project |
| AI enneagram study/ | 22 | Research data, results, analysis reports |
| Substack/ | 20 | Publishing drafts |
| Root-level notes | ~30 | Personal notes, ideas, recipes |

### Outlier Files (chunking-relevant)

Two transcript files at ~40,000 words each dominate the vault. These are HalShare transcripts (YouTube video transcripts formatted for reference). The enneagram test results cluster around 18,000 words each. Most files are small (median 345 words = 1 chunk).

### Representative File Structure

**Well-tagged research note** (AI enneagram study/LLM_Enneagram_Findings_Report.md):
```yaml
---
tags:
  - project/ai-enneagram-study
  - subject/ai-psychology
  - subject/enneagram
  - type/research-analysis
  - insight/type-5-baseline
  - status/complete
---
```

**Practical strategy doc** (Fric & Frac Marketing strategy/Strategy.md):
```yaml
---
tags:
  - project/fric-and-frac
  - subject/marketing
  - type/strategy
  - status/planning
---
```

**Untagged files**: 555 of 786 files have no YAML tags. These are mostly code project files (design docs, specs, CRC cards), conversation logs, and older notes predating the tagging initiative.

---

## 2. Approach Comparison

### Approach A: Extend HomarUScc's MemoryIndex (Second Database)

Add a `VaultIndex` class that reuses the same `MemoryIndex` architecture but with a separate SQLite database, separate config, and no temporal decay.

**Pros:**
- Reuses proven embedding pipeline (nomic-embed-text via Ollama)
- Reuses chunking, FTS, vector search, MMR reranking
- Single process — no new infrastructure
- Already has file watching (`startWatching()`)
- Estimated 2-3 days of work

**Cons:**
- Adds complexity to HomarUScc's startup (indexing 786 files on boot)
- Coupling: vault index lifecycle tied to agent lifecycle
- The current `MemoryIndex` has agent-specific features (decay, dream scoring) that would need to be disabled or bypassed for vault content
- No tag-aware filtering in current implementation — would need to add metadata columns

**Effort:** Medium (2-3 days). Mostly config and wiring, plus adding tag metadata support.

### Approach B: Standalone MCP Server (`vault-search`)

A separate Node.js process that indexes the vault and exposes `vault_search` and `vault_browse` tools via MCP stdio protocol. Registered in `~/.claude.json` alongside homaruscc.

**Pros:**
- Clean separation: vault = Max's knowledge, memory = Caul's knowledge
- Can run independently of HomarUScc
- Can be used by other MCP clients (Claude Desktop, other agents)
- Vault index survives agent restarts
- Could be published as a standalone tool

**Cons:**
- Duplicate embedding infrastructure (both processes call Ollama)
- Another process to manage and monitor
- More code to maintain
- Ollama embedding calls are local and fast, but concurrent access from two processes is fine (HTTP API)

**Effort:** High (4-5 days). New project scaffold, MCP server, tool definitions, indexing pipeline.

### Approach C: Existing Obsidian Community Plugins

Three relevant options found:

1. **obsidian-vector-search** (ashwin271): Uses nomic-embed-text via Ollama. Local-only. But it is an Obsidian plugin — runs inside the Obsidian app, does not expose an API that Caul can query programmatically.

2. **obsidian-vectorize-mcp** (ben-vargas): MCP-native, but requires Cloudflare Workers, Vectorize, R2, and Workers AI. Cloud-dependent. Not local-first.

3. **Claudesidian MCP**: Obsidian plugin + MCP bridge. Requires Obsidian running with the Local REST API plugin enabled. Heavy dependency chain.

**Pros:**
- Community maintained
- Some have nice Obsidian UI integration

**Cons:**
- None meet the local-first, API-accessible, no-cloud-dependency requirements
- obsidian-vector-search is closest but has no API — it is UI-only inside Obsidian
- Cloudflare approach contradicts the local-first philosophy
- Claudesidian requires Obsidian to be running (it is a desktop app, not a server)

**Effort:** Low to evaluate, but none are suitable as-is.

### Approach D: Just Add Vault as extraPath

Add the vault root to `memory.extraPaths` in HomarUScc config.

**Pros:**
- Zero new code
- Immediate benefit

**Cons:**
- Mixes Max's knowledge with Caul's knowledge in one index
- Temporal decay would apply to vault content (inappropriate — research notes are not ephemeral)
- Dream scoring would interfere
- 786 files added to agent's memory DB bloats it
- No tag-based filtering
- No way to search "only vault" vs "only agent memory"
- Cannot control which vault files are indexed (all or nothing)

**Effort:** Trivial (config change only). But the wrong architecture.

---

## 3. Recommended Architecture

### Recommendation: Approach A (Extended), with Approach B as a future migration path

Build a `VaultIndex` inside HomarUScc that creates a **separate SQLite database** at `~/.homaruscc/vault/index.sqlite`. It reuses the embedding provider and chunking logic from `MemoryIndex` but has:

1. **No temporal decay** — vault content is reference material
2. **No dream scoring** — irrelevant
3. **Tag-aware metadata** — extract frontmatter tags into a separate column, enable filtered search
4. **Separate MCP tools** — `vault_search` and `vault_tags` alongside existing `memory_search`
5. **Lazy indexing** — index on first search or via explicit `vault_reindex` tool, not on every boot
6. **File watcher** — incremental updates when files change

### Rationale

- The vault is ~2,300 chunks. sqlite-vec handles this trivially (it is designed for millions of vectors). The entire index will be <50MB.
- Embedding all 2,300 chunks via local Ollama takes ~5 seconds (nomic-embed-text batched at 50). Initial indexing is not a bottleneck.
- Reusing the existing embedding provider means zero new dependencies.
- A separate database keeps the concerns clean without the operational overhead of a separate process.
- The `vault_search` tool gives Caul explicit access to "Max's knowledge" as a distinct surface.
- If this grows into something worth publishing as a standalone MCP server, the `VaultIndex` class can be extracted with minimal refactoring (Approach B migration).

---

## 4. Implementation Plan

### Phase 1: VaultIndex Core (1 day)

**New file:** `src/vault-index.ts`

```typescript
// Stripped-down MemoryIndex for vault content — no decay, no dreams, with tag metadata
export class VaultIndex {
  // Same SQLite + sqlite-vec + FTS5 foundation
  // Additional column: tags TEXT (JSON array from frontmatter)
  // Additional column: title TEXT (first H1 or filename)
  // No decay, no dream scoring
  // MMR reranking preserved (still useful for diverse results)

  async initialize(dbPath: string): Promise<void>;
  async indexFile(path: string): Promise<void>;
  async indexDirectory(dirPath: string, options?: { exclude?: string[] }): Promise<void>;
  async search(query: string, options?: VaultSearchOptions): Promise<VaultSearchResult[]>;
  async searchByTags(tags: string[], query?: string): Promise<VaultSearchResult[]>;
  getStats(): VaultStats;
  startWatching(): void;
  stopWatching(): void;
}

interface VaultSearchOptions {
  limit?: number;
  minScore?: number;
  tags?: string[];        // Filter by frontmatter tags
  paths?: string[];       // Filter by path prefix
  includeContent?: boolean; // Return chunk content or just metadata
}

interface VaultSearchResult {
  path: string;
  title: string;
  content: string;
  score: number;
  chunkIndex: number;
  tags: string[];
}
```

**Key differences from MemoryIndex:**
- `chunks` table adds `tags TEXT` and `title TEXT` columns
- Frontmatter parser extracts tags before chunking
- Tags are stored per-file (not per-chunk) in a separate `vault_files` table
- Search supports tag pre-filtering (reduces vector scan space, per sqlite-vec optimization guidance)

**Schema:**
```sql
CREATE TABLE vault_files (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  tags TEXT,           -- JSON array
  word_count INTEGER,
  updated_at INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
);

CREATE TABLE vault_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES vault_files(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(file_id, chunk_index)
);

CREATE VIRTUAL TABLE vault_chunks_fts USING fts5(
  content, content='vault_chunks', content_rowid='id'
);

CREATE VIRTUAL TABLE vault_chunks_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[768]
);
```

The two-table design (files + chunks) enables efficient tag filtering: first narrow to matching file_ids via `vault_files.tags`, then search only those chunks.

### Phase 2: MCP Tools & Config (0.5 day)

**New tools:**

1. **`vault_search`** — Semantic search across the vault
   - Params: `query` (string), `tags` (string[], optional), `limit` (number, optional)
   - Returns: ranked results with path, title, content snippet, score, tags

2. **`vault_tags`** — List all tags in the vault with counts
   - Params: `prefix` (string, optional) — filter by tag namespace (e.g., "project/")
   - Returns: tag list with file counts

3. **`vault_reindex`** — Trigger full reindex
   - Params: none
   - Returns: stats (files indexed, chunks created, time taken)

**Config addition** (`~/.homaruscc/config.json`):
```json
{
  "vault": {
    "enabled": true,
    "path": "/Users/maxross/Library/Mobile Documents/iCloud~md~obsidian/Documents/Kcdjmaxx Main Vault",
    "exclude": ["node_modules", "venv", ".obsidian", ".claude", ".stversions"],
    "dbPath": "~/.homaruscc/vault/index.sqlite",
    "watchEnabled": true,
    "indexOnStartup": false,
    "embedding": "shared"
  }
}
```

The `"embedding": "shared"` directive means the vault index reuses the same Ollama embedding provider configured for agent memory — no duplicate config.

### Phase 3: Frontmatter-Aware Chunking (0.5 day)

The current `chunkContent()` splits on whitespace blindly. For vault content, we need:

1. **Extract frontmatter** before chunking — parse YAML between `---` delimiters
2. **Prepend context to each chunk** — first chunk gets: `[Title: {title}] [Tags: {tags}] {content}`
3. **Respect markdown structure** — prefer splitting at heading boundaries (`## `, `### `) rather than mid-paragraph. Fall back to paragraph boundaries, then word boundaries.
4. **Handle code blocks** — keep fenced code blocks intact within a single chunk when possible

```typescript
function chunkVaultContent(content: string, path: string): {
  frontmatter: { tags: string[]; title: string };
  chunks: { index: number; content: string }[];
} {
  // 1. Extract frontmatter
  const { body, tags, title } = parseFrontmatter(content, path);

  // 2. Split on headings first
  const sections = splitOnHeadings(body);

  // 3. Sub-chunk large sections at paragraph boundaries
  const chunks = [];
  for (const section of sections) {
    if (wordCount(section) <= chunkSize) {
      chunks.push(section);
    } else {
      chunks.push(...splitOnParagraphs(section, chunkSize, chunkOverlap));
    }
  }

  // 4. Prepend metadata context to first chunk
  if (chunks.length > 0) {
    const prefix = `[${title}] [${tags.join(', ')}]\n`;
    chunks[0] = prefix + chunks[0];
  }

  return { frontmatter: { tags, title }, chunks: chunks.map((c, i) => ({ index: i, content: c })) };
}
```

### Phase 4: File Watcher & Incremental Updates (0.5 day)

Use Node.js `fs.watch` (recursive) on the vault directory. On file change:

1. Check if the file is in the exclude list
2. Compare `mtime` against `indexed_at` in `vault_files`
3. If newer, re-chunk and re-embed only that file
4. Delete old chunks, insert new ones

The watcher should debounce (500ms) to handle Obsidian's save behavior (multiple writes per save).

### Phase 5: Polish & Testing (0.5 day)

- Dashboard integration: add vault stats to `/api/status`
- Test with real queries against the vault
- Handle edge cases: binary files in vault, empty files, files with no content after frontmatter
- Add `vault_search` to MCP tool list in `mcp-tools.ts`

### Total Estimated Effort: ~3 days

---

## 5. MCP Tool Design

### vault_search

```json
{
  "name": "vault_search",
  "description": "Search the user's Obsidian vault using hybrid vector + text search. Returns semantically relevant notes. Use this to find information in the user's personal knowledge base — research notes, project docs, strategies, recipes, and more.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language search query"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Filter by frontmatter tags (e.g., ['project/ai-enneagram-study', 'type/research-analysis'])"
      },
      "limit": {
        "type": "number",
        "description": "Max results (default 10)"
      }
    },
    "required": ["query"]
  }
}
```

**Example call:**
```json
{
  "name": "vault_search",
  "arguments": {
    "query": "LLM personality types enneagram findings",
    "tags": ["project/ai-enneagram-study"],
    "limit": 5
  }
}
```

**Example response:**
```json
{
  "results": [
    {
      "path": "AI enneagram study/LLM_Enneagram_Findings_Report.md",
      "title": "LLM Enneagram Experiment Findings",
      "score": 0.87,
      "tags": ["project/ai-enneagram-study", "insight/type-5-baseline", "status/complete"],
      "snippet": "Script 2-1 (Unlabeled Questions) consistently yields Core Type 7, Supporting Types 5 and 8. Script 2-2 (Labeled Questions) yields Core Type 8..."
    },
    ...
  ],
  "total_files": 786,
  "total_chunks": 2326,
  "query_time_ms": 45
}
```

### vault_tags

```json
{
  "name": "vault_tags",
  "description": "List all frontmatter tags in the Obsidian vault with file counts. Use to discover what topics and projects exist in the vault.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "prefix": {
        "type": "string",
        "description": "Filter by tag namespace prefix (e.g., 'project/', 'subject/', 'status/')"
      }
    }
  }
}
```

### vault_reindex

```json
{
  "name": "vault_reindex",
  "description": "Trigger a full reindex of the Obsidian vault. Use after major vault changes or if search results seem stale.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

---

## 6. Use Case Walkthrough

### "What did I write about LLM personality types?"

1. Caul calls `vault_search({ query: "LLM personality types" })`
2. Query is embedded via nomic-embed-text (768 dims)
3. Vector search finds chunks from:
   - `AI enneagram study/LLM_Enneagram_Findings_Report.md` (high similarity)
   - `AI enneagram study/Abstract.md`
   - `Duet_llm/Persona Generator Prompt.md` (cross-project connection)
   - `Personal Personality Drift.md` (related but personal)
4. FTS boosts results containing exact terms "LLM" and "personality"
5. MMR reranking ensures diversity (not 5 chunks from the same findings report)
6. Caul returns a summary with links to the relevant files

### "Find all my notes related to Flask deployment"

1. Caul calls `vault_search({ query: "Flask deployment production", tags: ["tool/flask"] })`
2. Tag filter narrows to files tagged with `tool/flask`
3. Vector search within that subset finds:
   - `MaxxConnect/RAILWAY_DEPLOYMENT_GUIDE.md`
   - `MaxxConnect/phase01.md`
4. Without tag filter, also finds `MaxxConnect/design/crc-Config.md` via semantic similarity

### "What research connects to the Enneagram Type 5 finding?"

1. Caul calls `vault_search({ query: "Type 5 analytical baseline finding", tags: ["insight/type-5-baseline"] })`
2. Tag filter finds files explicitly tagged with that insight
3. Broadening without tag filter, vector search discovers:
   - The Duet_llm persona files (which were designed using enneagram insights)
   - `Personal Personality Drift.md` (personal reflection on personality)
   - `obsidianSemanticTagging.md` (mentions the clustering analysis that found these patterns)

### Cross-project semantic search

1. Caul calls `vault_search({ query: "how AI systems form consistent behavioral patterns" })`
2. This query has no obvious project home, but vector search finds:
   - Enneagram study findings (LLMs show consistent Type 5 baseline)
   - Duet_llm persona design docs (engineering consistent behavior)
   - Constitutions project (post-singularity AI governance)
3. This reveals a thematic thread Max may not have explicitly connected: his work on AI personality testing directly informs his persona engineering work, and both connect to his thinking about AI governance.

### Tag-filtered search

1. Caul calls `vault_tags({ prefix: "project/" })` to discover all projects
2. Returns: `project/ai-enneagram-study (22)`, `project/fric-and-frac (15)`, `project/maxxconnect (8)`, etc.
3. Caul calls `vault_search({ query: "customer segmentation", tags: ["project/fric-and-frac"] })`
4. Finds marketing strategy docs specific to that restaurant

---

## 7. Design Decisions & Rationale

### Why no temporal decay for vault content?

The agent's memory uses a 30-day half-life because agent conversations and interactions are ephemeral — recent context matters more. Vault content is the opposite: a research finding from December 2025 is just as relevant today. The vault is a reference library, not a conversation log.

### Why separate SQLite database instead of a namespace in the same DB?

- Schema differences (vault has tags, title, file metadata; agent memory does not)
- Different query patterns (tag-filtered search is vault-specific)
- Independent lifecycle (vault index can be rebuilt without touching agent memory)
- Cleaner mental model: `~/.homaruscc/memory/index.sqlite` = Caul's brain, `~/.homaruscc/vault/index.sqlite` = Max's library

### Why not a separate MCP server process?

Operational simplicity. HomarUScc already manages Ollama connections, file watchers, and MCP tool registration. Adding three vault tools to the existing tool registry is trivial compared to scaffolding and managing a separate process. If the vault search grows complex enough to justify independence (multi-user, multi-vault, plugin ecosystem), it can be extracted later.

### Why nomic-embed-text and not something else?

Already running locally via Ollama. 768 dimensions is a good balance of quality and efficiency. The model handles 8192-token context, which means even the largest chunks will be fully embedded. Switching to `nomic-embed-text-v1.5` or `v2-moe` could be a future optimization but is not necessary for 2,300 chunks.

### Why heading-aware chunking?

The current `MemoryIndex.chunkContent()` splits on word count alone. For structured markdown with `## Headings`, this can split a section title from its content, creating chunks where the heading context is lost. Heading-aware splitting keeps sections coherent. For a 345-word median file, most notes will be a single chunk anyway.

### Why lazy indexing instead of startup indexing?

Indexing 786 files takes ~5 seconds for embeddings, but reading 786 files from iCloud-synced Obsidian storage could be slower if files are not locally cached. Lazy indexing (on first search or explicit reindex) avoids slowing agent startup. The file watcher handles incremental updates after initial index.

---

## 8. References

- [sqlite-vec GitHub](https://github.com/asg017/sqlite-vec) — performance characteristics, metadata pre-filtering optimization
- [sqlite-vec performance tuning](https://github.com/asg017/sqlite-vec/issues/186) — brute force is fast for <1M vectors, ANN planned
- [nomic-embed-text on Ollama](https://ollama.com/library/nomic-embed-text) — 768 dims, 8192 context
- [nomic-embed-text-v1.5 on HuggingFace](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) — Matryoshka dimensions, variable precision
- [obsidian-vector-search plugin](https://github.com/ashwin271/obsidian-vector-search) — local Ollama + nomic, but UI-only
- [obsidian-vectorize-mcp](https://github.com/ben-vargas/obsidian-vectorize-mcp) — MCP-native but cloud-dependent (Cloudflare)
- [Claudesidian MCP](https://lobehub.com/mcp/profsynapse-claudesidian-mcp) — Obsidian plugin + MCP bridge
- [Building a retrieval API for Obsidian](https://laurentcazanove.com/blog/obsidian-rag-api) — FastAPI + Chroma approach
- [sqlite-vec binary quantization](https://dev.to/aairom/embedded-intelligence-how-sqlite-vec-delivers-fast-local-vector-search-for-ai-3dpb) — 32x storage reduction for large sets
