// CRC: local/vault-indexer/design/crc-UnifiedSearch.md | Seq: local/vault-indexer/design/seq-unified-search.md
// UnifiedSearch — merges results from VaultIndex and MemoryIndex with source-aware weighting
// Requirements: V22-V28, V32, V33
import type { Logger, MemoryIndexLike, MemorySearchResult } from "./types.js";
import type { VaultIndex, VaultSearchResult } from "./vault-index.js";

export interface UnifiedWeights {
  memory: number;
  vaultCollaborative: number;
  vaultUnmediated: number;
  vaultDream: number;
}

export interface UnifiedSearchResult {
  path: string;
  content: string;
  score: number;
  chunkIndex: number;
  source: "memory" | "vault";
}

const DEFAULT_WEIGHTS: UnifiedWeights = {
  memory: 1.0,
  vaultCollaborative: 0.8,
  vaultUnmediated: 0.4,
  vaultDream: 0.5,
};

export class UnifiedSearch {
  private vaultIndex: VaultIndex;
  private memoryIndex: MemoryIndexLike;
  private weights: UnifiedWeights;
  private logger: Logger;

  constructor(
    vaultIndex: VaultIndex,
    memoryIndex: MemoryIndexLike,
    weights: Partial<UnifiedWeights> | undefined,
    logger: Logger,
  ) {
    this.vaultIndex = vaultIndex;
    this.memoryIndex = memoryIndex;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.logger = logger;
  }

  // V22, V28: Query both indexes in parallel, merge with source-aware weighting
  async search(query: string, options?: { limit?: number }): Promise<UnifiedSearchResult[]> {
    const limit = options?.limit ?? 10;

    // Parallel query both indexes
    const [vaultResults, memoryResults] = await Promise.all([
      this.vaultIndex.search(query, { limit }),
      this.memoryIndex.search(query, { limit }),
    ]);

    // Collect memory paths for collaborative classification
    const memoryPaths = new Set(memoryResults.map((r) => r.path));

    // V27: Deduplicate — drop vault results whose path (after resolving) exists in memory
    const { vault: dedupedVault, memory: dedupedMemory } = this.deduplicateResults(
      vaultResults, memoryResults, memoryPaths,
    );

    const unified: UnifiedSearchResult[] = [];

    // V23: Memory results with 1.0 weight
    for (const r of dedupedMemory) {
      unified.push({
        path: r.path,
        content: r.content,
        score: r.score * this.weights.memory,
        chunkIndex: r.chunkIndex,
        source: "memory",
      });
    }

    // V24, V25: Vault results with collaborative/unmediated weighting
    for (const r of dedupedVault) {
      const classification = this.classifyVaultResult(r, memoryPaths);
      const weight = this.getWeight(classification);
      unified.push({
        path: r.path,
        content: r.content,
        score: r.score * weight,
        chunkIndex: r.chunkIndex,
        source: "vault",
      });
    }

    // Sort by weighted score descending, slice to limit
    unified.sort((a, b) => b.score - a.score);
    return unified.slice(0, limit);
  }

  // V24, V25: Classify vault result based on memory index presence
  private classifyVaultResult(
    result: VaultSearchResult,
    memoryPaths: Set<string>,
  ): "collaborative" | "unmediated" {
    // Check if the vault file path has a corresponding entry in memory index
    // The vault result path is relative; check if any memory path ends with it
    for (const memPath of memoryPaths) {
      if (memPath.endsWith(result.path) || result.path.endsWith(memPath)) {
        return "collaborative";
      }
    }
    return "unmediated";
  }

  private getWeight(classification: "collaborative" | "unmediated"): number {
    switch (classification) {
      case "collaborative": return this.weights.vaultCollaborative;
      case "unmediated": return this.weights.vaultUnmediated;
    }
  }

  // V27: Deduplicate by path — memory wins over vault for same file
  private deduplicateResults(
    vaultResults: VaultSearchResult[],
    memoryResults: MemorySearchResult[],
    memoryPaths: Set<string>,
  ): { vault: VaultSearchResult[]; memory: MemorySearchResult[] } {
    const dedupedVault = vaultResults.filter((vr) => {
      // Check if any memory result has the same file path
      for (const mp of memoryPaths) {
        if (mp.endsWith(vr.path) || vr.path.endsWith(mp)) {
          return false; // Drop vault version, memory wins
        }
      }
      return true;
    });

    return { vault: dedupedVault, memory: memoryResults };
  }

  // Hot-update weights from config reload
  updateWeights(weights: Partial<UnifiedWeights>): void {
    Object.assign(this.weights, weights);
  }
}
