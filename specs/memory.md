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

### Boosts

Two boost layers applied before MMR re-ranking:

1. **Domain boost** (structural) — `memory.search.domainBoosts` is an array of `{pattern, boost}` entries. For each result, the max-matching substring rule multiplies the combined score. Default: `/identity/=2.0`, `/memory/MEMORY.md=1.8`, `/user/=1.3`, `/crm/=1.15`. Rationale: foundational files (soul, user, CRM) are rarely retrieved so use-dependent boosting has nothing to work with; structural boost compensates for cold-start.
2. **Use-dependent boost** (retrievalBoost) — `1 + log(count+1) * retrievalBoost`, capped at `retrievalBoostCap`. Defaults: boost 0.4, cap 1.5. Rewards files that have been retrieved before. Multiplies on top of domain boost.

Both are configurable via `config.json` `memory.search.*`. Autoresearch-tunable.

## Embeddings

- Pluggable embedding provider using OpenAI-compatible API (works with Ollama, OpenAI, etc.)
- Default: Ollama nomic-embed-text (768 dimensions)
- Batch embedding support for efficient indexing

## File Watching

- Optional file watcher for automatic re-indexing when .md files change
- Can index entire directories and extra paths from config

## Store Operation

- The `memory_store` tool writes content to a file path and indexes it in one operation
