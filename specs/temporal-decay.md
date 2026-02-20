# Temporal Decay on Memory Search Results

**Language:** TypeScript
**Environment:** Node.js 22+, SQLite (better-sqlite3), existing memory-index.ts

## Overview

Memory search results should favor recent content over old content. A 30-day half-life exponential decay multiplier is applied to search scores so that older memories naturally fade unless they remain relevant.

## Behavior

When searching memory, each result's combined score (vector + FTS) is multiplied by a decay factor based on how old the chunk is. The decay uses an exponential half-life model:

```
decayMultiplier = 0.5 ^ (ageDays / halfLifeDays)
```

With a 30-day half-life:
- 0 days old → multiplier = 1.0
- 30 days old → multiplier = 0.5
- 60 days old → multiplier = 0.25
- 180 days old → multiplier ≈ 0.016

## Evergreen Content

Some content should never decay:
- Files with no `updated_at` timestamp (legacy data)
- Paths matching configurable evergreen patterns (e.g., `MEMORY.md`, `SOUL.md`, `USER.md`)

Evergreen content gets a decay multiplier of 1.0 regardless of age.

## Configuration

The decay should be configurable via the existing config system:

- `memory.decay.enabled` — boolean, default true
- `memory.decay.halfLifeDays` — number, default 30
- `memory.decay.evergreenPatterns` — string array, default `["MEMORY.md", "SOUL.md", "USER.md"]`

Decay can be disabled entirely by setting `enabled: false`, which makes the system behave as before (no decay).

## Implementation Scope

This is a search-time change only. No changes to indexing, storage, or database schema. The `updated_at` column already exists on the chunks table. The decay multiplier is applied after the hybrid score is computed but before the minScore filter and final sort.
