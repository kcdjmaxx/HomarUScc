// Local type definitions for vault-indexer module
// Duplicated from main project to keep vault-indexer self-contained and gitignored

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;
}

// Mirror of MemoryIndex.search result shape
export interface MemorySearchResult {
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
}

// Interface for the MemoryIndex dependency (duck-typed, not imported)
export interface MemoryIndexLike {
  search(query: string, options?: { limit?: number }): Promise<MemorySearchResult[]>;
}
