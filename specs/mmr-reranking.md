# MMR (Maximal Marginal Relevance) Re-ranking

## Overview

After computing hybrid search scores (vector + FTS + temporal decay), re-rank results using MMR to balance relevance with diversity. This prevents returning multiple near-identical chunks from the same document when diverse results would be more useful.

## Behavior

MMR iteratively selects results. At each step, it picks the candidate that maximizes:

```
MMR(d) = lambda * relevance(d) - (1 - lambda) * max_similarity(d, selected)
```

Where:
- `relevance(d)` is the existing hybrid score (already includes decay)
- `max_similarity(d, selected)` is the highest cosine similarity between candidate `d` and any already-selected result
- `lambda` controls the relevance-diversity trade-off (1.0 = pure relevance, 0.0 = pure diversity)

## Similarity Computation

When an embedding provider is available, compute cosine similarity between chunk embeddings for the diversity penalty. When no embedding provider is available, fall back to Jaccard similarity on word sets (intersection/union of unique words).

## Configuration

- `memory.search.mmrLambda`: float 0.0-1.0, default 0.7 (moderate diversity)
- `memory.search.mmrEnabled`: boolean, default true

## Edge Cases

- If only 1 result, return it directly (no re-ranking needed)
- If embedding provider unavailable, use word-set Jaccard similarity as fallback
- MMR re-ranking happens after decay but before the final slice to `limit`
- The candidate pool for MMR is the full set of results above `minScore`, not just the top `limit`
