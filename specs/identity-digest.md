# Identity Digest

**Language:** TypeScript
**Environment:** Node.js >= 22

Token optimization for the event loop: compress the identity payload returned by `/api/wait` from ~3K tokens (full soul + user + state) to ~200 tokens on normal wakes.

## Problem

Every `/api/wait` wake returned the full identity payload (soul.md, user.md, state.md) — roughly 3,000 tokens. Since the event loop runs continuously, this burns significant context on every single event, even though identity only needs full re-injection after context compaction erases it.

## Solution

Two delivery modes for identity in `/api/wait` responses:

### Digest mode (default, ~200 tokens)

On normal wakes, return a compressed digest containing:
- Agent name (extracted from soul.md `**Name: ...**` pattern)
- Vibe section (core behavioral rules from soul.md `## Vibe`)
- Last session mood (first paragraph of state.md `## Last Session`)

This is enough to maintain personality consistency without the full payload.

### Full mode (post-compaction, ~3K tokens)

After context compaction occurs, the next `/api/wait` response returns the full identity (soul, user, state) so the post-compaction instance can fully re-adopt the persona.

## Mechanism

- `IdentityManager.getDigest()` extracts the compressed identity fields via regex
- `CompactionManager` tracks a `compactedSinceLastWake` flag, set to `true` in `handlePostCompact()` and consumed (reset to false) by `consumeCompactionFlag()`
- `/api/wait` checks the compaction flag: if set, returns full identity; otherwise returns digest
- Response includes `identity.full: boolean` so the event loop script and skill prompt can branch on format

## Skill Prompt Update

The skill prompt (`skill.md`) documents both response formats with JSON examples and explains when to expect each. The event loop handler checks `identity.full` to decide whether to do a full persona re-adoption or just a quick personality refresher.
