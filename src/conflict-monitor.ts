// CRC: crc-ConflictMonitor.md | Seq: seq-conflict-detect.md
// ACC Conflict Monitor — detects contradictions, prediction errors, and behavioral inconsistencies
import type { Logger } from "./types.js";
import type { SearchResult } from "./memory-index.js";

export interface Conflict {
  type: "prediction_error" | "behavioral" | "memory_contradiction" | "effort_reward";
  severity: "low" | "medium" | "high" | "critical";
  domain: string;
  emotionalWeight: number;   // 0-1
  cognitiveWeight: number;   // 0-1
  description: string;
}

export interface StoredConflict extends Conflict {
  id: number;
  resolution: string | null;
  resolutionSource: string | null;
  resolvedAt: number | null;
  createdAt: number;
}

export interface ConflictResolution {
  conflictId: number;
  resolution: string;
  source: "auto" | "user" | "reconsolidation" | "dream";
}

export interface EventContext {
  domain?: string;
  query?: string;
}

interface ConflictRow {
  id: number;
  type: string;
  severity: string;
  domain: string | null;
  emotional_weight: number;
  cognitive_weight: number;
  description: string;
  resolution: string | null;
  resolution_source: string | null;
  resolved_at: number | null;
  created_at: number;
}

const SEVERITY_LEVELS: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEVERITY_NAMES = ["low", "medium", "high", "critical"] as const;
const MAX_ACTIVE_PER_DOMAIN = 5;
const DECAY_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MS_PER_DAY = 86_400_000;

export class ConflictMonitor {
  private db: import("better-sqlite3").Database | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  initialize(db: import("better-sqlite3").Database): void {
    this.db = db;
    this.logger.info("ConflictMonitor initialized");
    // Run decay on initialization
    this.decayOldConflicts();
  }

  /**
   * Phase A conflict detection — runs within <50ms budget.
   * 1. Compare top-2 result scores and timestamps (~1ms)
   * 2. Check if query domain has open conflicts in SQLite (~5ms)
   * 3. If domain has conflicts, cross-reference current results (~20ms)
   */
  checkConflicts(searchResults: SearchResult[], context?: EventContext): Conflict[] {
    if (!this.db || searchResults.length === 0) return [];

    const conflicts: Conflict[] = [];
    const domain = context?.domain ?? this.inferDomain(searchResults);

    // 1. Score divergence check — if top-2 results have very different scores,
    // it may indicate contradictory information at different confidence levels
    if (searchResults.length >= 2) {
      const [first, second] = searchResults;
      const scoreDiff = first.score - second.score;
      // If scores are close but content is from very different paths, flag potential contradiction
      if (scoreDiff < 0.05 && first.path !== second.path) {
        const contentOverlap = this.computeContentOverlap(first.content, second.content);
        if (contentOverlap < 0.2) {
          conflicts.push({
            type: "memory_contradiction",
            severity: "low",
            domain,
            emotionalWeight: 0.2,
            cognitiveWeight: 0.5,
            description: `Near-equal scores for divergent content: "${first.path}" vs "${second.path}" (score diff: ${scoreDiff.toFixed(3)}, overlap: ${contentOverlap.toFixed(2)})`,
          });
        }
      }
    }

    // 2. Check open conflicts in this domain
    const openConflicts = this.getOpenConflicts(domain);

    // 3. Cross-reference current results against most recent domain conflict
    if (openConflicts.length > 0) {
      const mostRecent = openConflicts[0];
      // If the most recent conflict mentions a path that appears in current results,
      // the conflict is still active
      for (const result of searchResults.slice(0, 3)) {
        if (mostRecent.description.includes(result.path)) {
          // Existing conflict still relevant — don't create a new one, but note it
          this.logger.debug("Active conflict still relevant to current search", {
            conflictId: mostRecent.id,
            path: result.path,
          });
        }
      }
    }

    // OCD Safeguard: Rate limit — max 5 active conflicts per domain
    const activeCount = openConflicts.length;
    const filtered = conflicts.filter(() => {
      return activeCount < MAX_ACTIVE_PER_DOMAIN;
    });

    return filtered;
  }

  logConflict(conflict: Conflict): number {
    if (!this.db) return -1;

    const stmt = this.db.prepare(`
      INSERT INTO conflict_log (type, severity, domain, emotional_weight, cognitive_weight, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      conflict.type,
      conflict.severity,
      conflict.domain,
      conflict.emotionalWeight,
      conflict.cognitiveWeight,
      conflict.description,
      Date.now(),
    );
    this.logger.info("Conflict logged", {
      id: result.lastInsertRowid,
      type: conflict.type,
      severity: conflict.severity,
      domain: conflict.domain,
    });
    return Number(result.lastInsertRowid);
  }

  resolveConflict(resolution: ConflictResolution): void {
    if (!this.db) return;

    this.db.prepare(`
      UPDATE conflict_log
      SET resolution = ?, resolution_source = ?, resolved_at = ?
      WHERE id = ?
    `).run(resolution.resolution, resolution.source, Date.now(), resolution.conflictId);

    this.logger.info("Conflict resolved", {
      id: resolution.conflictId,
      source: resolution.source,
    });
  }

  getOpenConflicts(domain?: string): StoredConflict[] {
    if (!this.db) return [];

    let rows: ConflictRow[];
    if (domain) {
      rows = this.db.prepare(
        "SELECT * FROM conflict_log WHERE resolved_at IS NULL AND domain = ? ORDER BY created_at DESC",
      ).all(domain) as ConflictRow[];
    } else {
      rows = this.db.prepare(
        "SELECT * FROM conflict_log WHERE resolved_at IS NULL ORDER BY created_at DESC",
      ).all() as ConflictRow[];
    }

    return rows.map(this.rowToConflict);
  }

  getConflictStats(): {
    total: number;
    open: number;
    byDomain: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    if (!this.db) return { total: 0, open: 0, byDomain: {}, bySeverity: {} };

    const total = (this.db.prepare("SELECT COUNT(*) as cnt FROM conflict_log").get() as { cnt: number }).cnt;
    const open = (this.db.prepare("SELECT COUNT(*) as cnt FROM conflict_log WHERE resolved_at IS NULL").get() as { cnt: number }).cnt;

    const domainRows = this.db.prepare(
      "SELECT domain, COUNT(*) as cnt FROM conflict_log WHERE resolved_at IS NULL GROUP BY domain",
    ).all() as Array<{ domain: string | null; cnt: number }>;
    const byDomain: Record<string, number> = {};
    for (const row of domainRows) {
      byDomain[row.domain ?? "unknown"] = row.cnt;
    }

    const severityRows = this.db.prepare(
      "SELECT severity, COUNT(*) as cnt FROM conflict_log WHERE resolved_at IS NULL GROUP BY severity",
    ).all() as Array<{ severity: string; cnt: number }>;
    const bySeverity: Record<string, number> = {};
    for (const row of severityRows) {
      bySeverity[row.severity] = row.cnt;
    }

    return { total, open, byDomain, bySeverity };
  }

  /**
   * Should trigger a review if 3+ conflicts in the same domain in the last 7 days.
   */
  shouldTriggerReview(domain: string): boolean {
    if (!this.db) return false;

    const cutoff = Date.now() - 7 * MS_PER_DAY;
    const count = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM conflict_log WHERE domain = ? AND created_at > ?",
    ).get(domain, cutoff) as { cnt: number }).cnt;

    return count >= 3;
  }

  /**
   * Get unresolved conflicts for the dream cycle to process.
   * Returns conflicts ordered by severity (highest first), then age (oldest first).
   */
  getUnresolvedForDream(): StoredConflict[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM conflict_log
      WHERE resolved_at IS NULL
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 3
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 1
          ELSE 0
        END DESC,
        created_at ASC
      LIMIT 10
    `).all() as ConflictRow[];

    return rows.map(this.rowToConflict);
  }

  /**
   * Get retrieval boost for a domain based on unresolved conflicts.
   * Unresolved conflict in a domain → +0.1 retrieval boost.
   */
  getRetrievalBoost(domain: string): number {
    if (!this.db) return 0;

    const count = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM conflict_log WHERE domain = ? AND resolved_at IS NULL",
    ).get(domain) as { cnt: number }).cnt;

    return count > 0 ? 0.1 : 0;
  }

  /**
   * Get recent conflicts (for dashboard display).
   */
  getRecentConflicts(limit = 10): StoredConflict[] {
    if (!this.db) return [];

    const rows = this.db.prepare(
      "SELECT * FROM conflict_log ORDER BY created_at DESC LIMIT ?",
    ).all(limit) as ConflictRow[];

    return rows.map(this.rowToConflict);
  }

  /**
   * Log a conflict the monitor missed — user corrected something the ACC didn't catch.
   * This is the recall signal: real conflicts that went undetected.
   */
  logMissedConflict(domain: string, description: string): number {
    if (!this.db) return -1;

    const stmt = this.db.prepare(
      "INSERT INTO missed_conflict_log (domain, description, source, created_at) VALUES (?, ?, 'user', ?)",
    );
    const result = stmt.run(domain, description, Date.now());
    this.logger.info("Missed conflict logged", {
      id: result.lastInsertRowid,
      domain,
    });
    return Number(result.lastInsertRowid);
  }

  /**
   * Monthly report — includes precision AND recall tracking.
   */
  generateMonthlyReport(): string {
    if (!this.db) return "ConflictMonitor not initialized.";

    const cutoff = Date.now() - 30 * MS_PER_DAY;

    const total = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM conflict_log WHERE created_at > ?",
    ).get(cutoff) as { cnt: number }).cnt;

    const resolved = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM conflict_log WHERE created_at > ? AND resolved_at IS NOT NULL",
    ).get(cutoff) as { cnt: number }).cnt;

    // Precision: of resolved conflicts, how many had a meaningful resolution (not "auto-decayed")?
    const meaningfulResolutions = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM conflict_log WHERE created_at > ? AND resolved_at IS NOT NULL AND resolution_source != 'auto'",
    ).get(cutoff) as { cnt: number }).cnt;

    const precision = resolved > 0 ? meaningfulResolutions / resolved : 1;
    const precisionWarning = precision < 0.5
      ? "\n**WARNING**: Precision below 50% — consider raising intervention threshold."
      : "";

    // Recall: how many real conflicts did we miss? (user-reported corrections the ACC didn't catch)
    const missed = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM missed_conflict_log WHERE created_at > ?",
    ).get(cutoff) as { cnt: number }).cnt;

    // Recall = detected / (detected + missed). Detected = total conflicts flagged.
    const detected = total;
    const recall = (detected + missed) > 0 ? detected / (detected + missed) : 1;
    const recallWarning = recall < 0.5
      ? "\n**WARNING**: Recall below 50% — the monitor is missing real conflicts. Consider lowering detection thresholds."
      : "";

    // Hypoactive ACC warning: if missed > detected, the monitor is functionally silent
    const hypoactiveWarning = missed > detected && missed > 0
      ? "\n**ALERT**: More conflicts missed than detected — possible hypoactive ACC. Review detection heuristics."
      : "";

    const stats = this.getConflictStats();
    const domainLines = Object.entries(stats.byDomain)
      .map(([d, c]) => `  - ${d}: ${c} open`)
      .join("\n");
    const severityLines = Object.entries(stats.bySeverity)
      .map(([s, c]) => `  - ${s}: ${c}`)
      .join("\n");

    // Missed conflicts by domain
    const missedDomainRows = this.db.prepare(
      "SELECT domain, COUNT(*) as cnt FROM missed_conflict_log WHERE created_at > ? GROUP BY domain",
    ).all(cutoff) as Array<{ domain: string | null; cnt: number }>;
    const missedDomainLines = missedDomainRows
      .map(r => `  - ${r.domain ?? "unknown"}: ${r.cnt} missed`)
      .join("\n");

    return [
      "# Conflict Monitor — Monthly Report",
      "",
      `**Period:** Last 30 days`,
      `**Total conflicts detected:** ${total}`,
      `**Resolved:** ${resolved}`,
      `**Missed (user-reported):** ${missed}`,
      "",
      `**Precision:** ${(precision * 100).toFixed(0)}% (${meaningfulResolutions}/${resolved} meaningful)`,
      precisionWarning,
      `**Recall:** ${(recall * 100).toFixed(0)}% (${detected} detected / ${detected + missed} total real conflicts)`,
      recallWarning,
      hypoactiveWarning,
      "",
      `**Currently open:** ${stats.open}`,
      "",
      "**By domain:**",
      domainLines || "  (none)",
      "",
      "**By severity:**",
      severityLines || "  (none)",
      "",
      missed > 0 ? "**Missed conflicts by domain:**" : "",
      missed > 0 ? (missedDomainLines || "  (none)") : "",
    ].filter(Boolean).join("\n");
  }

  /**
   * OCD Safeguard: Decay unresolved conflicts — downgrade severity by 1 level per 30 days.
   */
  private decayOldConflicts(): void {
    if (!this.db) return;

    const now = Date.now();
    const openConflicts = this.db.prepare(
      "SELECT * FROM conflict_log WHERE resolved_at IS NULL",
    ).all() as ConflictRow[];

    let decayed = 0;
    for (const row of openConflicts) {
      const ageMs = now - row.created_at;
      const decaySteps = Math.floor(ageMs / DECAY_INTERVAL_MS);
      if (decaySteps <= 0) continue;

      const currentLevel = SEVERITY_LEVELS[row.severity] ?? 0;
      const newLevel = Math.max(0, currentLevel - decaySteps);

      if (newLevel < currentLevel) {
        const newSeverity = SEVERITY_NAMES[newLevel];
        this.db.prepare(
          "UPDATE conflict_log SET severity = ? WHERE id = ?",
        ).run(newSeverity, row.id);
        decayed++;

        // If decayed to low and already been low for a full cycle, auto-resolve
        if (newLevel === 0 && decaySteps >= 2) {
          this.db.prepare(
            "UPDATE conflict_log SET resolution = ?, resolution_source = ?, resolved_at = ? WHERE id = ?",
          ).run("Auto-decayed after prolonged inactivity", "auto", now, row.id);
        }
      }
    }

    if (decayed > 0) {
      this.logger.info("Decayed old conflicts", { count: decayed });
    }
  }

  private inferDomain(results: SearchResult[]): string {
    // Infer domain from the first result's path
    if (results.length === 0) return "general";
    const path = results[0].path;
    if (path.includes("identity/") || path.includes("soul") || path.includes("preferences")) return "identity";
    if (path.includes("user/") || path.includes("user.md")) return "user-intent";
    if (path.includes("journal/")) return "reflection";
    if (path.includes("dreams/")) return "dream";
    if (path.includes("corrections/") || path.includes("patterns/")) return "behavioral";
    if (path.includes("src/") || path.includes("technical")) return "technical";
    return "general";
  }

  /**
   * Simple content overlap metric: Jaccard similarity on word sets.
   */
  private computeContentOverlap(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    return intersection / (wordsA.size + wordsB.size - intersection);
  }

  private rowToConflict(row: ConflictRow): StoredConflict {
    return {
      id: row.id,
      type: row.type as Conflict["type"],
      severity: row.severity as Conflict["severity"],
      domain: row.domain ?? "unknown",
      emotionalWeight: row.emotional_weight,
      cognitiveWeight: row.cognitive_weight,
      description: row.description,
      resolution: row.resolution,
      resolutionSource: row.resolution_source,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }
}
