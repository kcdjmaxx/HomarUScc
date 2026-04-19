# CRC: ConflictMonitor

**Source:** `src/conflict-monitor.ts`
**Spec:** specs/acc-build-brief.md (brief + "Refinements Shipped" section)
**Questionnaire:** specs/acc-conflict-monitor-questionnaire.md

## Responsibility

Computational model of the anterior cingulate cortex. Detects contradictions, prediction errors, and behavioral inconsistencies during memory retrieval, records them in `conflict_log`, and (a) alerts Max through a fast-loop notifier when severity or burst gates fire, and (b) auto-resolves conflicts that later retrieval disambiguates. Long-tail unresolved conflicts decay.

## Collaborators

- **MemoryIndex** — provides the SQLite DB; `conflict_log` table lives there
- **mcp-tools `memory_search`** — calls `checkForAutoResolutions(...)` then `checkConflicts(...)` on every search; logs any detected conflicts
- **ChannelManager (via homaruscc)** — target of the fast-loop notifier for Telegram alerts
- **TelegramCommandHandler** — `/missed` writes to `missed_conflict_log`; `/resolve` calls `resolveById`
- **Dream cycle** — consumes `getUnresolvedForDream()` (top 10 open, severity-then-age ordered)
- **Weekly reconsolidation timer** — confirms patterns, promotes auto-decayed entries, surfaces clusters

## State

- `db: better-sqlite3.Database | null` — memory DB, shared with MemoryIndex
- `fastLoopNotifier: FastLoopNotifier | null` — optional Telegram-side callback
- `alertConfig: AlertConfig` — severityThreshold, burstThreshold, burstWindowMs, rateLimitMs, enabled
- `lastAlertAt: Map<string, number>` — rate-limit key = `"<gate>:<domain>"`

## Interface

```typescript
interface Conflict {
  type: "prediction_error" | "behavioral" | "memory_contradiction" | "effort_reward";
  severity: "low" | "medium" | "high" | "critical";
  domain: string;
  emotionalWeight: number;  // 0-1
  cognitiveWeight: number;  // 0-1
  description: string;
}

interface FastLoopAlert {
  conflictId: number;
  gate: "severity" | "burst";
  conflict: Conflict;
  burstCount?: number;
  burstWindowMs?: number;
}

interface AlertConfig {
  enabled: boolean;
  severityThreshold: "high" | "critical";
  burstThreshold: number;
  burstWindowMs: number;
  rateLimitMs: number;
}

class ConflictMonitor {
  initialize(db: Database): void;

  // Detection
  checkConflicts(results: SearchResult[], context?: EventContext): Conflict[];
  logConflict(conflict: Conflict): number;           // also evaluates fast-loop gates

  // Resolution — three sources
  checkForAutoResolutions(results: SearchResult[], domain?: string, minScoreDiff?: number): number;  // source="auto"
  resolveById(id: number, resolution: string, source?: "user"|"auto"|...): { ok, status, conflict? };
  resolveConflict(resolution: ConflictResolution): void;  // low-level

  // Introspection
  getOpenConflicts(domain?: string): StoredConflict[];
  getRecentConflicts(limit?: number): StoredConflict[];
  getUnresolvedForDream(): StoredConflict[];
  getConflictStats(): { total, open, byDomain, bySeverity };
  getRetrievalBoost(domain: string): number;  // +0.1 when domain has open conflicts
  shouldTriggerReview(domain: string): boolean;  // 3+ in 7 days

  // Recall tracking
  logMissedConflict(domain: string, description: string): number;

  // Reporting + maintenance
  generateMonthlyReport(): string;

  // Fast-loop alert wiring (Step D)
  setFastLoopNotifier(fn: FastLoopNotifier | null): void;
  setAlertConfig(config: Partial<AlertConfig>): void;
  getAlertConfig(): AlertConfig;
}
```

## Severity Classification

`classifyContradictionSeverity(scoreDiff, overlap, domain)`:
- default → `low`
- tight ambiguity (`scoreDiff < 0.02` AND `overlap < 0.05`) → `medium`
- tight ambiguity AND domain ∈ {`user-intent`, `identity`} → `high`
- `critical` reserved for explicit user escalation via `/missed` promotion (future)

## Fast-Loop Alert Gates (Step D)

After `logConflict` inserts a row, `checkFastLoopAlert` evaluates:
1. **Severity gate** — if severity level ≥ configured threshold → dispatch immediately; short-circuit (don't also evaluate burst for the same event)
2. **Burst gate** — if count of conflicts in same domain within `burstWindowMs` ≥ `burstThreshold` → dispatch

`dispatchAlert` applies the rate limit: per `(gate, domain)` key, max one alert per `rateLimitMs`. Suppressed alerts log at debug level.

## Auto-Resolver

`checkForAutoResolutions` runs at the top of every `memory_search`. For each open `memory_contradiction` in the current domain, parses the two paths from the stored description (format: `"pathA" vs "pathB"`), looks them up in the current top-5, and resolves only if both reappear with a widened gap (`scoreDiff > minScoreDiff`, default 0.15). Unilateral presence is intentionally left to the decay path.

## OCD Safeguards

- **Rate limit:** max 5 active conflicts per domain (`checkConflicts` filters)
- **Decay:** unresolved conflicts downgrade 1 severity level per 30 days; auto-resolve with `source="auto"`, text `"Auto-decayed after prolonged inactivity"` once decayed to low for 2+ cycles
- **Precision gate:** monthly report compares meaningful resolutions to auto-decay; hypoactive ACC warning when `missed > detected`

## Design Notes

- All DB writes go through the monitor — do not mutate `conflict_log` directly from other modules
- `fastLoopNotifier` is optional and swappable; the monitor knows nothing about Telegram
- Severity levels live in a small const map (`{low:0, medium:1, high:2, critical:3}`) so thresholds can be compared numerically
