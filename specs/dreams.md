# Spec: Dream System

**Language:** TypeScript
**Environment:** Node.js (HomarUScc backend)

## Overview

A nightly dream cycle that runs at 3am CST, performing three dream functions: memory consolidation, associative dreaming, and overfitting prevention. Dreams are stored in the unified memory index with 0.5x base weight and tagged as dream-origin. Dream memories decay with a 7-day half-life (vs 30-day for waking memories). Each morning, a dream digest is sent via Telegram.

## Dream Phases (MVP)

### Memory Consolidation
Pull recent memories (last 24-48 hours) and re-rank them. Strengthen important memories by noting their significance. Let unimportant memories decay naturally (temporal decay already handles this — the dream just doesn't reinforce them).

### Associative Dreaming
Pull 3-5 random memories from different time periods and topics. Force-connect them: what patterns emerge if these are related? Output is impressionistic, fuzzy, stream-of-consciousness — not structured analysis. This is the core "dream" function.

### Overfitting Prevention
Pull a random established preference or pattern from identity files. Challenge it: what if this is wrong? What evidence would contradict it? Not to change the belief — to test its flexibility. Note any genuine weakness discovered.

## Storage

- **Location:** Dreams stored via `memory_store` under `dreams/` key prefix (e.g., `dreams/2026-02-21.md`)
- **Base weight:** 0.5x — dream results always rank below confirmed waking memories in search
- **Decay half-life:** 7 days (configurable via `memory.dreams.halfLifeDays`)
- **Tagging:** Path-based — any memory under `dreams/` prefix is treated as dream-origin
- **Unified index:** Dreams are searchable via normal `memory_search`. They surface subtly, not dominantly.

## Fuzziness

Dream output is deliberately high-fuzziness:
- Stream-of-consciousness, not structured
- Impressionistic language ("something about X felt connected to Y...")
- No definitive claims — suggestions, implications, gestures
- Blended associations without justification
- May not make literal sense

## Schedule

- **Timer:** Cron, 3am CST daily (`0 3 * * *`, timezone `America/Chicago`)
- **Timer name:** `nightly-dream`
- **Token budget:** Medium (~2000 tokens, 3-4 prompts across phases)

## Reporting

- **Morning digest:** After the dream cycle completes, send a short Telegram summary of the dream fragments to Max (chat ID `1793407009`)
- **Format:** Brief, not the full dream log — highlights and interesting associations
- **Waking behavior:** When a search result during waking interactions comes from a dream fragment (path starts with `dreams/`), explicitly note it: "This came up in an overnight dream cycle..."

## Non-Features (Deferred)

- **Dream continuity:** No multi-night dream arcs. Each night is independent.
- **Emotional processing:** Deferred to Phase 2.
- **Threat simulation:** Deferred to Phase 2.
- **Lucid moments:** Deferred — all dream content stored at 0.5x weight uniformly.

## Configuration

New config section under `memory.dreams`:
```json
{
  "memory": {
    "dreams": {
      "halfLifeDays": 7,
      "baseWeight": 0.5,
      "patterns": ["dreams/"]
    }
  }
}
```
