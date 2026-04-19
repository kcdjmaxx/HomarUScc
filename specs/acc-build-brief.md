---
tags:
  - project/homaruscc
  - subject/agent-architecture
  - type/build-brief
  - status/shipped-with-refinements
---

# ACC Conflict Monitor — Build Brief

**Status:** Shipped (initial Phase A/B) + refinements landed 2026-04-19. See the "Refinements Shipped" section at the bottom for what changed beyond the original brief.
**Design spec:** specs/acc-conflict-monitor-questionnaire.md (22 questions, all answered)
**Build method:** /mini-spec → /build → /autoresearch
**Priority:** Build BEFORE Phase 3 (structured schema)

---

## What to Build

A computational model of the anterior cingulate cortex — a conflict/error monitoring system that detects contradictions, prediction errors, and behavioral inconsistencies, then feeds back into agent behavior.

## Architecture Decisions (locked)

| Decision | Choice |
|----------|--------|
| Module | New `src/conflict-monitor.ts` |
| Storage | SQLite `conflict_log` table in existing memory DB |
| Behavior | Hybrid: passive (low/medium), active (high/critical) |
| Real-time budget | <50ms per search |
| Batch analysis | Dream cycle (3am) + weekly reconsolidation |
| Severity | 4 levels: low, medium, high, critical |
| Context scope | Current + 24h history (real-time), full memory (batch) |
| Agent scope | Main loop monitors; background agents report conflicts back |
| Signal model | Single signal type, two weights: emotional + cognitive |
| Effort gating | Soft gate with narration for heavy tasks (>100k tokens) |

## Conflict Types (phased)

**Phase A (build now):**
- Prediction errors (existing data in prediction-errors.jsonl)
- Behavioral rule conflicts (identity files vs. stored corrections)

**Phase B (build next, set reminder):**
- Memory contradictions (two search results semantically disagree)

**Phase C (build last):**
- Effort-reward miscalculation

## Severity → Action Mapping

| Severity | Action | Example |
|----------|--------|---------|
| low | Log silently, adjust confidence | Two results slightly disagree on a date |
| medium | Auto-search for more context, then log | Prediction error in a known domain |
| high | Flag in response ("Note: stored preferences disagree on this") | Identity file contradicts a correction |
| critical | Flag + pause, wait for Max | Core rule contradiction, safety boundary |

## DB Schema

```sql
CREATE TABLE IF NOT EXISTS conflict_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,          -- 'prediction_error', 'behavioral', 'memory_contradiction', 'effort_reward'
  severity TEXT NOT NULL,       -- 'low', 'medium', 'high', 'critical'
  domain TEXT,                  -- 'user-intent', 'technical', 'conversation-flow', etc.
  emotional_weight REAL DEFAULT 0,
  cognitive_weight REAL DEFAULT 0,
  description TEXT NOT NULL,
  resolution TEXT,              -- null if unresolved
  resolution_source TEXT,       -- 'auto', 'user', 'reconsolidation', 'dream'
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conflict_domain ON conflict_log(domain);
CREATE INDEX IF NOT EXISTS idx_conflict_severity ON conflict_log(severity);
CREATE INDEX IF NOT EXISTS idx_conflict_resolved ON conflict_log(resolved_at);
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/conflict-monitor.ts` | **CREATE** — ConflictMonitor class with checkConflicts(), logConflict(), getOpenConflicts(), getConflictStats() |
| `src/memory-index.ts` | **MODIFY** — Add conflict_log table creation in initialize() |
| `src/mcp-tools.ts` | **MODIFY** — Call checkConflicts() after memory_search, before returning results |
| `src/backend.ts` or `src/homaruscc.ts` | **MODIFY** — Initialize ConflictMonitor, wire into event loop |
| `src/dashboard-server.ts` | **MODIFY** — Add /api/conflict-health endpoint |
| Dream cycle prompt (config.json) | **MODIFY** — Add Phase 4: conflict resolution seeds |

## ConflictMonitor Class Interface

```typescript
interface Conflict {
  type: 'prediction_error' | 'behavioral' | 'memory_contradiction' | 'effort_reward';
  severity: 'low' | 'medium' | 'high' | 'critical';
  domain: string;
  emotionalWeight: number;   // 0-1
  cognitiveWeight: number;   // 0-1
  description: string;
}

interface ConflictResolution {
  conflictId: number;
  resolution: string;
  source: 'auto' | 'user' | 'reconsolidation' | 'dream';
}

class ConflictMonitor {
  initialize(db: Database): void;
  checkConflicts(searchResults: SearchResult[], context?: EventContext): Conflict[];
  logConflict(conflict: Conflict): number;
  resolveConflict(resolution: ConflictResolution): void;
  getOpenConflicts(domain?: string): Conflict[];
  getConflictStats(): { total: number; open: number; byDomain: Record<string, number>; bySeverity: Record<string, number> };
  shouldTriggerReview(domain: string): boolean;  // 3+ in 7 days
  getUnresolvedForDream(): Conflict[];  // seeds for dream cycle
  generateMonthlyReport(): string;
}
```

## OCD Safeguards

1. **Rate limit:** Max 5 active conflicts per domain
2. **Decay:** Unresolved conflicts downgrade 1 severity level per 30 days
3. **Precision gate:** If monthly precision <50%, auto-raise active intervention threshold

## Search Ranking Integration

- Unresolved conflict in a domain → +0.1 retrieval boost for that domain (explore)
- Conflict resolved → remove boost (exploit)
- Tunable via autoresearch later

## Build Order

1. Create `src/conflict-monitor.ts` with ConflictMonitor class
2. Add `conflict_log` table to memory-index.ts initialize()
3. Wire ConflictMonitor into backend initialization
4. Add checkConflicts() call in mcp-tools.ts memory_search handler
5. Add /api/conflict-health to dashboard-server.ts
6. Update dream cycle prompt with Phase 4
7. Create eval script for autoresearch
8. Run autoresearch on severity thresholds

## Reminders Set

- Evaluate domain-specific severity thresholds after 1 month of data
- Add memory contradiction detection (Phase B) after behavioral conflicts are stable
- Check explore-exploit tuning via autoresearch after 2 weeks
- Present monthly ACC report to Max for review

---

## Refinements Shipped (2026-04-19)

These all post-date the original brief and are live in main.

### Severity promotion (commit `5aaf39a`)
`memory_contradiction` was being logged with hardcoded `severity="low"`, which made the decay pipeline and alert gating useless. `classifyContradictionSeverity(scoreDiff, overlap, domain)` now promotes to `medium` when ambiguity is tight (`scoreDiff < 0.02` AND `overlap < 0.05`) and further to `high` when the tight-ambiguity case lands in a high-stakes domain (`user-intent`, `identity`). `critical` is reserved for explicit user escalation.

### `/missed` recall signal (commit `5aaf39a`)
Telegram-intercepted command that writes to a new `missed_conflict_log` table. Captures real conflicts the detector didn't catch — the recall-side counterpart to the precision metrics already tracked in `generateMonthlyReport()`. Domain is inferred from description keywords. Surfaces in the weekly conflict reconsolidation.

### Step D — fast-loop alerts (commit `82a74e3`)
`ConflictMonitor.logConflict` now evaluates two gates after insert:
- **Severity gate:** severity ≥ configured threshold (default `high`) → immediate alert
- **Burst gate:** ≥N (default 3) conflicts in same domain within window (default 10min) → alert

Dispatched through a pluggable `fastLoopNotifier` callback. `homaruscc.ts` wires this to ChannelManager.send → Telegram, target = first `channels.telegram.allowedChatIds`. Rate-limited per `(domain, gate)` at 1 hour to prevent spam. Config: `acc.alerts.{enabled, severityThreshold, burstThreshold, burstWindowMs, rateLimitMs, chatId, channel}`. Unit harness: 12/12.

### Resolver mechanism — fast path (commit `6b47fe7`, closes BUG-20260419-4 part A)
`ConflictMonitor.checkForAutoResolutions(results, domain?, minScoreDiff=0.15)` is called at the top of every `memory_search`. Parses `"pathA" vs "pathB"` out of each open `memory_contradiction` in the current domain, and if both paths reappear in the current top-5 with a score gap > `minScoreDiff`, resolves with `source="auto"` and resolution text naming winner/loser/diff. Unilateral presence is *not* resolved (that's the decay path's job — absence from one query's top-K doesn't prove global loss). Unit harness: 11/11.

### Resolver mechanism — user path (commit `8907255` + glue in `d10352f`, closes BUG-20260419-4 part B)
`/resolve <id> <note>` Telegram command routes to `ConflictMonitor.resolveById`, which validates existence + not-already-resolved and applies `source="user"`. With no args, the command lists up to 10 open conflicts for easy reference. Unit harness: 13/13.

### Backend extension loader (commit `d10352f`)
Not strictly ACC, but related: `backend.ts` now loads personal/business pipelines (hiring, reports) via a dynamic import of `./personal-extensions.js` (gitignored) wrapped in try/catch. Fresh clones of the public repo run without them. This also landed the committed `CommandContext` wiring for `logMissedConflict`, `resolveConflict`, and `listOpenConflicts` which had been stranded as uncommitted local edits.

### Eval patterns added
- `acc-fast-loop-alerts` — alert precision, p95 latency, rate-limit correctness, burst sensitivity, suppression-during-silence
- `acc-resolution-mechanism` — resolution-rate by source (expect auto + user + decay mix), mean non-decay time-to-resolution, auto-resolver precision spot-check, open-conflict trend

Findings log entries #5–#7 in `local/research/eval-findings-log.md`.

---

*To build: start a fresh session and say "build the ACC — read specs/acc-build-brief.md"*
