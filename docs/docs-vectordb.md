# Docs Vector DB

The docs vector DB provides domain-specific knowledge bases for the agent. Unlike the agent's personal memory (which stores experiences and facts with temporal decay), docs indexes are static reference material -- API documentation, framework guides, specification files -- that the agent can search when it needs domain expertise.

## Why it exists

An agent working across multiple technical domains needs access to reference material that does not belong in its personal memory. The docs system gives each domain its own isolated index:

- **TouchDesigner** operator reference
- **OpenClaw** configuration docs
- **API references** for services the agent integrates with
- **Framework documentation** for projects under development

Each domain gets its own SQLite database, keeping indexes independent and disposable. You can clear one domain without affecting others.

## Architecture

```
~/.homaruscc/docs/
    touchdesigner.sqlite    ← one DB per domain
    openclaw.sqlite
    react.sqlite

Each SQLite DB contains:
    chunks          ← text chunks with path + index
    chunks_fts      ← FTS5 full-text search index
    chunks_vec      ← sqlite-vec vector embeddings (if available)
```

The implementation lives in `src/docs-index.ts` with MCP tool wrappers in `src/tools/docs.ts`.

## Domain isolation

Every domain is a separate SQLite database at `~/.homaruscc/docs/<domain>.sqlite`. Domains are created lazily when content is first ingested. This isolation means:

- Searching "touchdesigner" only hits TouchDesigner docs
- Clearing a domain deletes one file (the `.sqlite` + WAL/SHM files)
- Domains can be different sizes without cross-contamination
- Use `domain: "*"` with `docs_search` to search across all domains

## Ingesting content

### From files or directories

The `docs_ingest` tool accepts a file path or directory path. For directories, it recursively scans for supported file types:

**Supported extensions:** `.md`, `.txt`, `.html`, `.json`, `.yaml`, `.yml`, `.rst`, `.xml`

Directories named `.` (dotfiles) and `node_modules` are skipped.

```
# Ingest a single file
docs_ingest({ domain: "touchdesigner", path: "/path/to/operators.md" })

# Ingest an entire directory
docs_ingest({ domain: "react", path: "/path/to/react-docs/" })
```

Each file is chunked, stored in the `chunks` table, and (if an embedding provider is available) embedded into the `chunks_vec` table.

Re-ingesting the same path replaces existing chunks for that path (DELETE then INSERT within a transaction).

### From raw text

The `docs_ingest_text` tool indexes text content directly without saving to disk. This is useful for scraped web pages, API responses, or generated summaries.

```
docs_ingest_text({
  domain: "touchdesigner",
  key: "api/operators/moviefilein",
  content: "The Movie File In TOP reads video files..."
})
```

The `key` serves as a virtual path -- re-ingesting the same key replaces the previous content.

## Hybrid search

Searches combine FTS5 full-text search with sqlite-vec vector similarity, weighted and merged:

```
Final score = (FTS BM25 normalized) * ftsWeight + (1 - cosine distance) * vectorWeight
```

### Default weights

| Parameter | Default | Description |
|-----------|---------|-------------|
| `vectorWeight` | 0.7 | Weight for vector similarity |
| `ftsWeight` | 0.3 | Weight for FTS BM25 score |

The vector component captures semantic similarity (finding related content even with different wording), while FTS captures exact keyword matches. Results below a score of 0.05 are filtered out.

### Search scope

- **Single domain:** `docs_search({ domain: "touchdesigner", query: "movie file input" })`
- **All domains:** `docs_search({ domain: "*", query: "movie file input" })`

Cross-domain search (`*`) checks both loaded domains and unloaded ones on disk, opening databases as needed.

## Chunking strategy

Content is split into overlapping chunks by word count:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `chunkSize` | 400 | Words per chunk |
| `chunkOverlap` | 80 | Words of overlap between consecutive chunks |

The overlap ensures that concepts spanning chunk boundaries are captured in at least one chunk. The algorithm splits on whitespace and advances by `chunkSize - chunkOverlap` words per step.

Example for a 1000-word document with defaults:
- Chunk 0: words 0-399
- Chunk 1: words 320-719
- Chunk 2: words 640-999

## Database schema

Each domain SQLite database has three tables:

### `chunks` (main storage)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-incrementing chunk ID |
| `path` | TEXT | File path or virtual key |
| `chunk_index` | INTEGER | Position within the source file |
| `content` | TEXT | Chunk text content |
| `updated_at` | INTEGER | Timestamp (ms since epoch) |

Unique constraint on `(path, chunk_index)`.

### `chunks_fts` (full-text search)

FTS5 virtual table synced with `chunks` via triggers (INSERT, UPDATE, DELETE). Enables BM25 ranking.

### `chunks_vec` (vector embeddings)

sqlite-vec virtual table with a `float[N]` embedding column (dimension N comes from the embedding provider, default 768). Embeddings are stored as `Uint8Array` wrappers around `Float32Array` buffers (a workaround for sqlite-vec binding quirks).

## MCP tools

Five tools are registered when a `DocsIndex` is available:

| Tool | Description | Required params |
|------|-------------|-----------------|
| `docs_search` | Search a domain index | `domain`, `query` |
| `docs_ingest` | Ingest files or directories | `domain`, `path` |
| `docs_ingest_text` | Ingest raw text content | `domain`, `key`, `content` |
| `docs_list` | List all domains with stats | (none) |
| `docs_clear` | Delete a domain entirely | `domain` |

### docs_search

```
docs_search({ domain: "touchdesigner", query: "composite TOP blending", limit: 5 })
```

Returns formatted results with domain, path, score, and content preview (first 500 chars per result).

### docs_ingest

```
docs_ingest({ domain: "openclaw", path: "/path/to/openclaw-docs/" })
```

Returns: `Ingested into "openclaw": 47 files, 312 chunks`

### docs_ingest_text

```
docs_ingest_text({
  domain: "touchdesigner",
  key: "wiki/movie-file-in",
  content: "The Movie File In TOP reads..."
})
```

Returns: `Ingested into "touchdesigner" as "wiki/movie-file-in": 3 chunks`

### docs_list

```
docs_list({})
```

Returns stats for each domain:
```
touchdesigner: 23 files, 156 chunks
openclaw: 47 files, 312 chunks
```

Includes both loaded (in-memory) and unloaded (on-disk only) domains.

### docs_clear

```
docs_clear({ domain: "touchdesigner" })
```

Closes the database connection, deletes the `.sqlite` file and any WAL/SHM files.

## Configuration

The `DocsIndex` constructor accepts optional overrides:

```typescript
new DocsIndex(logger, {
  baseDir: "~/.homaruscc/docs",    // where domain SQLite files live
  chunkSize: 400,                   // words per chunk
  chunkOverlap: 80,                 // overlap words
  vectorWeight: 0.7,                // vector similarity weight
  ftsWeight: 0.3,                   // FTS BM25 weight
});
```

## Use cases

### Indexing framework documentation

```
docs_ingest({ domain: "react", path: "/path/to/react.dev/docs/" })
docs_search({ domain: "react", query: "useEffect cleanup function" })
```

### Indexing API references from web scrapes

```
docs_ingest_text({
  domain: "zoho-mail",
  key: "api/messages/list",
  content: "GET /api/accounts/{accountId}/messages..."
})
```

### Cross-domain knowledge retrieval

```
docs_search({ domain: "*", query: "how to handle WebSocket connections" })
```

See also: [Plugins](plugins.md) for extending the tool system, [Dashboard](dashboard.md) for the memory browser (which searches the agent's personal memory, not docs).
