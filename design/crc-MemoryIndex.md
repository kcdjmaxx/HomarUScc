# MemoryIndex
**Requirements:** R33, R34, R35, R36, R37, R38, R39, R40, R41, R82, R83, R84, R85, R86, R87, R88, R89
**Refs:** ref-sqlite-vec

## Knows
- db: SQLite database connection
- embeddingProvider: optional provider for vector embeddings
- chunkSize: words per chunk (default 400)
- chunkOverlap: overlapping words (default 80)
- vectorWeight: weight for vector score (default 0.7)
- ftsWeight: weight for FTS score (default 0.3)
- decayEnabled: whether temporal decay is active (default true)
- decayHalfLifeDays: half-life in days for exponential decay (default 30)
- evergreenPatterns: path suffixes that skip decay (default ["MEMORY.md", "SOUL.md", "USER.md"])
- watcher: file system watcher for auto-reindex

## Does
- initialize: create database, tables (chunks, chunks_fts, chunks_vec), triggers
- indexFile: read file, chunk, store chunks, embed and store vectors
- indexDirectory: recursively index all .md files in a directory
- search: hybrid vector+FTS query, combine scores, apply temporal decay, filter by minScore, sort
- computeDecay: calculate decay multiplier for a chunk based on its updated_at and path
- isEvergreen: check if a path matches any evergreen pattern
- store: write content to file path and index it
- get: read raw file content by path
- startWatching: watch indexed paths for .md changes
- stopWatching: remove file watchers
- getStats: return fileCount, chunkCount, indexedPaths

## Collaborators
- EmbeddingProvider: generate vector embeddings
- HomarUScc: provides memory config (including decay settings)

## Implementation Notes
- sqlite-vec v0.1.6 requires Uint8Array (not Float32Array) for embedding data and CAST(? AS INTEGER) for vec0 primary key binding with better-sqlite3 v11+
- Default minScore is 0.1 (not 0.3) to avoid filtering valid vector matches after weighting

## Sequences
- seq-memory-search.md
