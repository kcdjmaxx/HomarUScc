# Test Design: MMR Re-ranking

**Source:** crc-MemoryIndex.md

## Test: MMR promotes diversity over duplicate content

**Purpose:** Verify that MMR selects diverse results when top candidates are near-identical
**Input:** 5 candidates — 3 from same file with similar content, 2 from different files. Lambda=0.7.
**Expected:** MMR selects the top-scored same-file chunk first, then prioritizes the different-file chunks over remaining same-file duplicates.
**Refs:** crc-MemoryIndex.md, R90, R91

## Test: Lambda=1.0 produces pure relevance ordering

**Purpose:** Verify that lambda=1.0 disables diversity and returns results in pure score order
**Input:** Same 5 candidates as above. Lambda=1.0.
**Expected:** Results ordered by hybrid score, identical to non-MMR ordering.
**Refs:** crc-MemoryIndex.md, R92

## Test: Lambda=0.0 maximizes diversity

**Purpose:** Verify that lambda=0.0 maximizes diversity (minimum similarity to selected)
**Input:** 5 candidates with known pairwise similarities. Lambda=0.0.
**Expected:** Each selected result is maximally different from previously selected results.
**Refs:** crc-MemoryIndex.md, R91, R92

## Test: Jaccard fallback when no embeddings

**Purpose:** Verify Jaccard word-set similarity is used when embedding provider is absent
**Input:** 3 candidates with overlapping word content, no embedding provider set.
**Expected:** MMR uses word overlap to compute similarity, promoting the chunk with least word overlap.
**Refs:** crc-MemoryIndex.md, R95

## Test: Single result skips MMR

**Purpose:** Verify that a single result passes through without MMR processing
**Input:** 1 candidate. MMR enabled.
**Expected:** Result returned unchanged.
**Refs:** crc-MemoryIndex.md, R97

## Test: MMR disabled returns score-sorted results

**Purpose:** Verify that mmrEnabled=false bypasses re-ranking entirely
**Input:** Multiple candidates. mmrEnabled=false.
**Expected:** Results ordered by hybrid score, no diversity adjustment.
**Refs:** crc-MemoryIndex.md, R93

## Test: Cosine similarity computation

**Purpose:** Verify cosine similarity between two known vectors
**Input:** Vector [1,0,0] and [0.7,0.7,0].
**Expected:** Cosine similarity ≈ 0.707
**Refs:** crc-MemoryIndex.md, R94
