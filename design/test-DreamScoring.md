# Test Design: DreamScoring
**Source:** crc-DreamScoring.md

## Test: isDreamContent identifies dream paths
**Purpose:** Verify path-based dream detection works with configurable patterns
**Input:** Paths: `dreams/2026-02-21.md`, `user/preferences/style`, `dreams/fragment.md`, `MEMORY.md`
**Expected:** First and third return true, second and fourth return false
**Refs:** crc-DreamScoring.md

## Test: dream paths use dream-specific decay
**Purpose:** Verify dream content decays with 7-day half-life instead of 30-day
**Input:** Dream path with `updated_at` = 7 days ago, regular path with `updated_at` = 7 days ago
**Expected:** Dream path decay ≈ 0.5, regular path decay ≈ 0.87 (30-day half-life)
**Refs:** crc-DreamScoring.md, crc-MemoryIndex.md

## Test: dream base weight applied to search results
**Purpose:** Verify dream results get 0.5x base weight multiplier
**Input:** Two chunks with identical hybrid scores — one at `dreams/test.md`, one at `memory/test.md`
**Expected:** Dream chunk score is 0.5x the regular chunk score
**Refs:** crc-DreamScoring.md, crc-MemoryIndex.md

## Test: dream config is independently configurable
**Purpose:** Verify dream scoring params can be set separately from global decay
**Input:** Set dreamHalfLifeDays=14, dreamBaseWeight=0.3, verify global halfLifeDays unchanged
**Expected:** Dream paths use 14-day half-life and 0.3x weight; regular paths use global 30-day
**Refs:** crc-DreamScoring.md

## Test: evergreen patterns still override dream patterns
**Purpose:** Verify that a file matching both evergreen and dream patterns gets evergreen treatment
**Input:** Path `dreams/MEMORY.md` (matches both dream pattern and evergreen pattern)
**Expected:** Treated as evergreen — no decay, no dream weight penalty
**Refs:** crc-DreamScoring.md, crc-MemoryIndex.md
