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

- Hybrid scoring: vector similarity (cosine distance, weight 0.5) combined with FTS BM25 rank (weight 0.5)
- Configurable weights and minimum score threshold (default 0.3)
- Returns results sorted by combined score with path, content preview, and score

### Boosts

Two boost layers applied before MMR re-ranking:

1. **Domain boost** (structural) — `memory.search.domainBoosts` is an array of `{pattern, boost}` entries. For each result, the max-matching substring rule multiplies the combined score. Default: uniform 3.0 for `/identity/`, `/memory/MEMORY.md`, `/user/`, `/crm/`. Rationale: foundational files (soul, user, CRM) are rarely retrieved so use-dependent boosting has nothing to work with; structural boost compensates for cold-start.
2. **Use-dependent boost** (retrievalBoost) — `1 + log(count+1) * retrievalBoost`, capped at `retrievalBoostCap`. Defaults: boost 0.8, cap 2.5. Rewards files that have been retrieved before. Multiplies on top of domain boost.

Both are configurable via `config.json` `memory.search.*`. Autoresearch-tunable via `autoresearch-memory/eval.cjs` + POST `/api/memory/reload-search-config`. The 2026-04-19 autoresearch run (21 experiments) established the pre-parent-context defaults at F1=0.7589 on a 112-case harness; the flat plateau around that config (11/21 ties) confirmed further gains need indexing/presentation changes, not knob tuning.

### Parent-context retrieval

After MMR rerank, the top-K results (default K=3) can be expanded with ±N neighbor chunks (default N=0, off in core) from the same file. The hit chunk stays FIRST so truncation-based display (index/summary detail) doesn't push it off-screen; neighbors append with a double-newline. Config via `memory.search.parentContextN` and `parentContextTopK`. When combined with `detail="summary"` (the new default for `memory_search`), parent-context expansion contributed F1 0.7589 → 0.8214 on the same harness — because the previous default `detail="index"` truncated results to ~120 chars and hid the expanded context from both the eval and Claude.

The `memory_search` MCP tool default detail level is now `summary` (300 chars, 2-3 sentences) rather than `index` (120 chars, first sentence). This matters both for retrieval eval (substring checks see more content) and for Claude's downstream reasoning (more context per hit, fewer `memory_get` follow-ups).

### Query expansion (caller-side)

Query rewriting is reasoning, not mechanical work. It lives in the caller (Claude Code), not the backend — matching the "apps talk to HomarUScc directly; Claude only wakes for reasoning" convention. The backend does not make outbound LLM calls from the search hot path.

When an initial `memory_search` underperforms — top result has a weak score, or doesn't contain the expected content — the caller should rephrase the query 2-3 ways and call `memory_search_multi` with all variants. Useful rewriting moves:

- Drop question-word prefixes: `"how to upload files via FTP"` → `"upload files FTP"`
- Split compound queries: `"Hal EC2 OpenClaw agent"` → `["Hal EC2", "OpenClaw agent", "Hal"]`
- Vary vocabulary: `"TouchDesigner particle collision"` → `"TouchDesigner emitter physics"`
- Reorder entity tokens: `"Roeland Park house Birch Street"` → `"Birch Street house Roeland Park"`

`memory_search_multi` runs each variant through the same scoring pipeline, dedups by chunk, keeps max score per chunk, and returns the top-K merged. One MCP call, one network round-trip.

## Embeddings

- Pluggable embedding provider using OpenAI-compatible API (works with Ollama, OpenAI, etc.)
- Default: Ollama nomic-embed-text (768 dimensions)
- Batch embedding support for efficient indexing

## File Watching

- Optional file watcher for automatic re-indexing when .md files change
- Can index entire directories and extra paths from config

## Store Operation

- The `memory_store` tool writes content to a file path and indexes it in one operation
