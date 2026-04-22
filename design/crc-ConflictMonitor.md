# CRC: ConflictMonitor

**Source:** `src/conflict-monitor.ts`
**Spec:** specs/acc-build-brief.md (brief + "Refinements Shipped" section)
**Questionnaire:** specs/acc-conflict-monitor-questionnaire.md

## Responsibility

Computational model of the anterior cingulate cortex. Detects contradictions, prediction errors, and behavioral inconsistencies at two bind-points — (1) **retrieval time** (during `memory_search`, the original entry-point) and (2) **output composition time** (before outbound text on Telegram/dashboard, added 2026-04-21 to close a confidence-without-evidence gap). Records them in `conflict_log`, alerts Max through a fast-loop notifier when severity or burst gates fire, and auto-resolves conflicts that later retrieval disambiguates. Long-tail unresolved conflicts decay.

## Collaborators

- **MemoryIndex** — provides the SQLite DB; `conflict_log` table lives there
- **mcp-tools `memory_search`** — calls `checkForAutoResolutions(...)` then `checkConflicts(...)` on every search; logs any detected conflicts
- **mcp-tools `telegram_send` / `dashboard_send`** — call `checkOutboundAssertion(text)` before send; log a `behavioral`/`high` conflict if a causal/attribution claim has no recent verifying tool call
- **mcp-tools handler wrap** — `createMcpTools` wraps every non-send handler to call `recordToolCall(name, argSummary)` automatically; the buffer is the evidence input for `checkOutboundAssertion`
- **mcp-tools `acc_log_missed`** — Claude-side wrapper around `logMissedConflict`
- **ChannelManager (via homaruscc)** — target of the fast-loop notifier for Telegram alerts
- **TelegramCommandHandler** — `/missed` writes to `missed_conflict_log`; `/resolve` calls `resolveById`
- **Dream cycle** — consumes `getUnresolvedForDream()` (top 10 open, severity-then-age ordered)
- **Weekly reconsolidation timer** — confirms patterns, promotes auto-decayed entries, surfaces clusters

## State

- `db: better-sqlite3.Database | null` — memory DB, shared with MemoryIndex
- `fastLoopNotifier: FastLoopNotifier | null` — optional Telegram-side callback
- `alertConfig: AlertConfig` — severityThreshold, burstThreshold, burstWindowMs, rateLimitMs, enabled
- `lastAlertAt: Map<string, number>` — rate-limit key = `"<gate>:<domain>"`
- `toolCallBuffer: Array<{name, argSummary, ts}>` — ring buffer (max 20) of recent tool calls; consumed by `checkOutboundAssertion` to decide whether the outbound text was preceded by evidence-gathering

## Interface

```typescript
interface Conflict {
  type: "prediction_error" | "behavioral" | "retrieval_ambiguity" | "effort_reward";
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

  // Detection — retrieval-time
  checkConflicts(results: SearchResult[], context?: EventContext): Conflict[];
  logConflict(conflict: Conflict): number;           // also evaluates fast-loop gates

  // Detection — output-time (added 2026-04-21 to close the
  // memory-search-only bind-point gap; was missing
  // confidence-without-evidence claims at outbound composition)
  recordToolCall(name: string, argSummary: string): void;          // ring buffer, max 20
  getRecentToolCalls(): ReadonlyArray<{ name, argSummary, ts }>;
  checkOutboundAssertion(text: string, options?: { domain?: string }): Conflict | null;

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

`checkForAutoResolutions` runs at the top of every `memory_search`. For each open `retrieval_ambiguity` in the current domain, parses the two paths from the stored description (format: `"pathA" vs "pathB"`), looks them up in the current top-5, and resolves only if both reappear with a widened gap (`scoreDiff > minScoreDiff`, default 0.15). Unilateral presence is intentionally left to the decay path.

## OCD Safeguards

- **Rate limit:** max 5 active conflicts per domain (`checkConflicts` filters)
- **Decay:** unresolved conflicts downgrade 1 severity level per 30 days; auto-resolve with `source="auto"`, text `"Auto-decayed after prolonged inactivity"` once decayed to low for 2+ cycles
- **Precision gate:** monthly report compares meaningful resolutions to auto-decay; hypoactive ACC warning when `missed > detected`

## Design Notes

- All DB writes go through the monitor — do not mutate `conflict_log` directly from other modules
- `fastLoopNotifier` is optional and swappable; the monitor knows nothing about Telegram
- Severity levels live in a small const map (`{low:0, medium:1, high:2, critical:3}`) so thresholds can be compared numerically
