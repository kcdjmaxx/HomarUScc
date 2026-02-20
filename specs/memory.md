# Memory

**Language:** TypeScript
**Environment:** Node.js >= 22, better-sqlite3, sqlite-vec

The memory system provides persistent, searchable storage using hybrid vector + full-text search.

## Storage

- SQLite database at `~/.homaruscc/memory/index.sqlite`
- Three tables: chunks (content), chunks_fts (FTS5 virtual table), chunks_vec (vector embeddings)
- Files are split into word-based chunks (400 words, 80 word overlap) for granular search
- Triggers auto-sync FTS and vector tables on insert/update/delete

## Search

- Hybrid scoring: vector similarity (cosine distance, weight 0.7) combined with FTS BM25 rank (weight 0.3)
- Configurable weights and minimum score threshold (default 0.3)
- Returns results sorted by combined score with path, content preview, and score

## Embeddings

- Pluggable embedding provider using OpenAI-compatible API (works with Ollama, OpenAI, etc.)
- Default: Ollama nomic-embed-text (768 dimensions)
- Batch embedding support for efficient indexing

## File Watching

- Optional file watcher for automatic re-indexing when .md files change
- Can index entire directories and extra paths from config

## Store Operation

- The `memory_store` tool writes content to a file path and indexes it in one operation
