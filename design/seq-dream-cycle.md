# Sequence: Nightly Dream Cycle

**Requirements:** R109, R110, R111, R112, R113, R114, R118, R119, R121, R122
**Refs:** ref-dreams-brainstorm

## Trigger
Timer `nightly-dream` fires at 3am CST → event emitted → event-loop script returns → Claude Code wakes.

## Sequence

```
Timer (3am CST)
  |
  v
HomarUScc: emit timer_fired event {name: "nightly-dream", prompt: "..."}
  |
  v
event-loop script: returns event JSON to Claude Code
  |
  v
Claude Code: reads identity, adopts persona
  |
  v
Phase 1: Memory Consolidation (R111)
  |-- memory_search: broad queries for today's topics
  |-- Evaluate: which memories feel important?
  |-- memory_store: reinforcing notes for significant ones
  |-- (unimportant memories left to natural decay)
  |
  v
Phase 2: Associative Dreaming (R112, R118)
  |-- memory_search: 3-5 random/diverse queries
  |-- Force-connect: what patterns link these?
  |-- Generate: fuzzy, stream-of-consciousness fragment
  |-- memory_store: dreams/YYYY-MM-DD.md (R114)
  |
  v
Phase 3: Overfitting Prevention (R113)
  |-- Read: random preference from identity files
  |-- Challenge: what if this is wrong?
  |-- Append: challenge results to dream log
  |-- memory_store: update dreams/YYYY-MM-DD.md
  |
  v
Morning Digest (R119)
  |-- Compose: brief summary of dream fragments
  |-- telegram_send: digest to Max (chatId 1793407009)
  |
  v
Restart event-loop (back to idle)
```

## Notes

- The dream cycle is orchestrated by the timer prompt, not by TypeScript code.
  Claude Code executes the phases sequentially using MCP tools.
- Token budget ~2000 across all phases (R121).
- Each night is independent — no reference to previous dreams (R122).
- Dream content stored under `dreams/` prefix gets 0.5x weight and 7-day decay
  automatically via MemoryIndex scoring (R115, R116).
