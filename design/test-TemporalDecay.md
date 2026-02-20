# Test Design: Temporal Decay
**Source:** crc-MemoryIndex.md

## Test: decay multiplier calculation
**Purpose:** Verify exponential decay formula produces correct values
**Input:** Various age values (0, 30, 60, 180 days) with 30-day half-life
**Expected:** Multipliers of 1.0, 0.5, 0.25, ~0.016 respectively
**Refs:** crc-MemoryIndex.md

## Test: evergreen paths skip decay
**Purpose:** Verify paths matching evergreen patterns get multiplier 1.0
**Input:** Paths ending in MEMORY.md, SOUL.md, USER.md with old timestamps
**Expected:** All return decay multiplier of 1.0
**Refs:** crc-MemoryIndex.md

## Test: null updated_at treated as evergreen
**Purpose:** Verify chunks without timestamps are not penalized
**Input:** Chunk with updated_at = 0 or null
**Expected:** Decay multiplier of 1.0
**Refs:** crc-MemoryIndex.md

## Test: decay applied after score combination
**Purpose:** Verify decay multiplies the combined hybrid score, not individual components
**Input:** Two chunks with same content relevance but different ages
**Expected:** Newer chunk scores higher after decay applied
**Refs:** crc-MemoryIndex.md, seq-memory-search.md

## Test: decay disabled returns original scores
**Purpose:** Verify setting decayEnabled=false produces pre-decay behavior
**Input:** Search with decay disabled, old chunks
**Expected:** Scores unchanged from pre-decay behavior
**Refs:** crc-MemoryIndex.md

## Test: custom half-life
**Purpose:** Verify configurable half-life changes decay rate
**Input:** 60-day half-life, 60-day-old content
**Expected:** Multiplier of 0.5 (not 0.25 as with 30-day half-life)
**Refs:** crc-MemoryIndex.md

## Test: custom evergreen patterns
**Purpose:** Verify custom patterns are respected
**Input:** Custom pattern ["CUSTOM.md"], path matching it
**Expected:** Matching path gets multiplier 1.0, non-matching paths decay normally
**Refs:** crc-MemoryIndex.md
