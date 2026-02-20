# MemoryIndex
**Requirements:** R33, R34, R35, R36, R37, R38, R39, R40, R41
**Refs:** ref-sqlite-vec

## Knows
- db: SQLite database connection
- embeddingProvider: optional provider for vector embeddings
- chunkSize: words per chunk (default 400)
- chunkOverlap: overlapping words (default 80)
- vectorWeight: weight for vector score (default 0.7)
- ftsWeight: weight for FTS score (default 0.3)
- watcher: file system watcher for auto-reindex

## Does
- initialize: create database, tables (chunks, chunks_fts, chunks_vec), triggers
- indexFile: read file, chunk, store chunks, embed and store vectors
- indexDirectory: recursively index all .md files in a directory
- search: hybrid vector+FTS query, combine scores, filter by minScore, sort
- store: write content to file path and index it
- get: read raw file content by path
- startWatching: watch indexed paths for .md changes
- stopWatching: remove file watchers
- getStats: return fileCount, chunkCount, indexedPaths

## Collaborators
- EmbeddingProvider: generate vector embeddings
- HomarUScc: provides memory config

## Implementation Notes
- sqlite-vec v0.1.6 requires Uint8Array (not Float32Array) for embedding data and CAST(? AS INTEGER) for vec0 primary key binding with better-sqlite3 v11+
- Default minScore is 0.1 (not 0.3) to avoid filtering valid vector matches after weighting

## Sequences
- seq-memory-search.md
