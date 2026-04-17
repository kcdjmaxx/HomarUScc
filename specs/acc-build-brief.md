---
tags:
  - project/homaruscc
  - subject/agent-architecture
  - type/build-brief
  - status/ready-to-build
---

# ACC Conflict Monitor — Build Brief

**Status:** Design complete, ready to build
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

*To build: start a fresh session and say "build the ACC — read specs/acc-build-brief.md"*
