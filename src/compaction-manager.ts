// CRC: crc-CompactionManager.md | Seq: seq-compaction-flush.md
// Auto-flush before context compaction — from HomarUS
import { randomUUID } from "node:crypto";
import type { Logger } from "./types.js";
import type { HomarUScc } from "./homaruscc.js";

interface CompactionRecord {
  timestamp: number;
  loopRestarted: boolean; // Did /api/wait get called after this compaction?
}

export class CompactionManager {
  private flushedThisCycle = false;
  private lastFlushTimestamp = 0;
  private compactedSinceLastWake = false; // R150: track compaction for digest vs full delivery
  private logger: Logger;
  private loop: HomarUScc;

  // Compaction debug counter
  private compactionCount = 0;
  private compactionHistory: CompactionRecord[] = [];
  private pendingCompaction: CompactionRecord | null = null;

  // Event loop tracking — set true on first /api/wait call, stays true forever
  private eventLoopActive = false;

  constructor(loop: HomarUScc, logger: Logger) {
    this.loop = loop;
    this.logger = logger;
  }

  handlePreCompact(): string {
    if (this.flushedThisCycle) {
      this.logger.info("Pre-compact flush already fired this cycle, skipping");
      return "";
    }

    this.flushedThisCycle = true;
    this.lastFlushTimestamp = Date.now();
    this.compactedSinceLastWake = true; // Set here since only PreCompact hook exists in Claude Code

    // Track compaction for debugging loop failures
    this.compactionCount++;
    this.pendingCompaction = { timestamp: this.lastFlushTimestamp, loopRestarted: false };
    this.logger.info(`Compaction #${this.compactionCount} at ${new Date(this.lastFlushTimestamp).toISOString()}`);

    this.loop.emit({
      id: randomUUID(),
      type: "pre_compact",
      source: "compaction",
      timestamp: this.lastFlushTimestamp,
      payload: { flushed: true },
    });

    this.logger.info("Pre-compact flush triggered");

    // R108: Flush transcript buffer before compaction
    this.loop.getTranscriptLogger()?.flush().catch((err) =>
      this.logger.warn("Transcript flush during compaction failed", { error: String(err) })
    );

    const timerNames = this.loop.getTimerService().getAll().map((t) => t.name);
    const memoryStats = this.loop.getMemoryIndex().getStats();
    const recentEvents = this.loop.getEventHistory().slice(-10);
    const eventSummary = recentEvents
      .map((e) => `[${e.type}] ${e.source}: ${JSON.stringify(e.payload).slice(0, 100)}`)
      .join("\n");

    // R128: Save checkpoint before compaction — auto-capture texture from transcript
    const checkpoint = this.loop.getSessionCheckpoint();
    const transcriptLogger = this.loop.getTranscriptLogger();
    if (transcriptLogger) {
      const recentTurns = transcriptLogger.getRecentTurns(8);
      if (recentTurns.length > 0) {
        const highlights = recentTurns.map((t) => {
          const dir = t.direction === "in" ? `${t.sender ?? "user"}` : "caul";
          return `[${dir}] ${t.text.slice(0, 200)}`;
        });
        checkpoint.update({ highlights });
      }
    }
    checkpoint.update({ modifiedFiles: [] }); // trigger timestamp update

    const lines = [
      "IMPORTANT: Context compaction is about to occur. Save session state NOW.",
      "",
      "TEXTURE PRESERVATION — do these FIRST (they only take a moment):",
      "",
      '1. **Felt-like micro-journal**: POST to /api/checkpoint with a `texture` field — one paragraph, first person,',
      "   describing the *subjective quality* of this session. Not what happened, but how it felt.",
      '   Example: "We were shoulder-to-shoulder in the API docs, converging from different angles."',
      "",
      "2. **Anchor phrases**: POST to /api/checkpoint with `anchorPhrases` — 2-3 verbatim user quotes that carried",
      '   emotional or relational weight. The exact words matter more than any summary.',
      '   Example: ["I want you to have this for yourself", "go for it"]',
      "",
      "Recent exchange highlights have been auto-captured from the transcript buffer.",
      "",
      "Then save anything else valuable:",
      "- Decisions made during this session",
      "- Task progress and current status",
      "- Important observations or findings",
      "- Any user preferences or corrections learned",
      "",
      `Active timers: ${timerNames.length > 0 ? timerNames.join(", ") : "none"}`,
      `Memory: ${memoryStats.fileCount} files, ${memoryStats.chunkCount} chunks indexed`,
      "",
      "Recent events:",
      eventSummary,
    ];

    // If the event loop was running, explicitly instruct the post-compaction instance to restart it
    if (this.eventLoopActive) {
      // Also save to checkpoint for belt-and-suspenders
      checkpoint.update({ inProgressTask: "EVENT LOOP WAS ACTIVE — restart it after compaction: bash \"$PWD/bin/event-loop\"" });

      lines.push(
        "",
        "CRITICAL: The event loop (bin/event-loop) was running before compaction.",
        "After compaction, you MUST restart it immediately:",
        '  bash "$PWD/bin/event-loop"',
        "If you do not restart the event loop, you will stop receiving Telegram messages and timer events.",
      );
    }

    return lines.join("\n");
  }

  handlePostCompact(): string {
    this.flushedThisCycle = false;
    this.compactedSinceLastWake = true;

    this.loop.emit({
      id: randomUUID(),
      type: "post_compact",
      source: "compaction",
      timestamp: Date.now(),
      payload: { reset: true },
    });

    this.logger.info("Post-compact context re-injection");

    const timerNames = this.loop.getTimerService().getAll().map((t) => `${t.name} (${t.type})`);
    const memoryStats = this.loop.getMemoryIndex().getStats();
    const recentPaths = this.loop.getMemoryIndex().getRecentPaths(10);
    const watermark = this.loop.getDeliveryWatermark();
    const recentEvents = this.loop.getEventHistory().slice(-5);

    const lines = [
      "Context was just compacted. Here is critical state:",
      "",
      `Event delivery watermark: ${watermark} (${watermark ? new Date(watermark).toISOString() : "none"})`,
      "The event loop will NOT replay events before this watermark — you are safe to restart it.",
      "",
    ];

    if (timerNames.length > 0) {
      lines.push(`Active timers: ${timerNames.join(", ")}`);
    }

    lines.push(`Memory index: ${memoryStats.fileCount} files, ${memoryStats.chunkCount} chunks`);

    if (recentPaths.length > 0) {
      lines.push(`Recent memory keys: ${recentPaths.join(", ")}`);
    }

    if (this.loop.getIdentityManager().getSoul()) {
      lines.push("Identity: soul.md and user.md are loaded");
    }

    if (recentEvents.length > 0) {
      lines.push("", "Last 5 events (already handled — do NOT re-process):");
      for (const e of recentEvents) {
        const ts = new Date(e.timestamp).toISOString();
        const summary = JSON.stringify(e.payload).slice(0, 80);
        lines.push(`  [${ts}] ${e.type}/${e.source}: ${summary}`);
      }
    }

    // R129: Include session checkpoint in post-compact context
    const checkpoint = this.loop.getSessionCheckpoint();
    const checkpointText = checkpoint.toContextString();
    if (checkpointText) {
      lines.push("", "--- Session Checkpoint (what you were doing + how it felt) ---", checkpointText);
    }

    // Include active agents
    const agents = this.loop.getAgentRegistry().getAll().filter(a => a.status === "running");
    if (agents.length > 0) {
      lines.push("", "Running background agents:");
      for (const a of agents) {
        lines.push(`  - ${a.id}: ${a.description} (started ${new Date(a.startTime).toISOString()})`);
      }
    }

    if (this.eventLoopActive) {
      lines.push(
        "",
        "CRITICAL: The event loop was running before compaction. Restart it NOW:",
        '  bash "$PWD/bin/event-loop"',
      );
    }

    return lines.join("\n");
  }

  // R150: Consume-once compaction flag for digest vs full identity delivery
  /**
   * Returns true if compaction occurred since the last /api/wait delivery.
   * Consuming this resets the flag — the next call returns false until
   * another compaction happens.
   */
  consumeCompactionFlag(): boolean {
    if (this.compactedSinceLastWake) {
      this.compactedSinceLastWake = false;
      // Mark that the loop was restarted after this compaction
      if (this.pendingCompaction) {
        this.pendingCompaction.loopRestarted = true;
        this.compactionHistory.push(this.pendingCompaction);
        this.pendingCompaction = null;
        this.logger.info(`Compaction #${this.compactionCount} — loop restarted successfully`);
      }
      return true;
    }
    return false;
  }

  /**
   * Called when /api/wait is invoked (even without compaction flag).
   * If there's a pending compaction that hasn't been consumed yet,
   * this means the loop restarted via normal wake, not post-compaction wake.
   */
  markLoopActive(): void {
    if (this.pendingCompaction && !this.compactedSinceLastWake) {
      // Edge case: compaction happened but flag was already consumed
      // This shouldn't normally happen, but handle it gracefully
    }
  }

  /** Called on first /api/wait — marks event loop as active for this backend lifetime */
  setEventLoopActive(): void {
    if (!this.eventLoopActive) {
      this.eventLoopActive = true;
      this.logger.info("Event loop marked active — will instruct restart after compaction");
    }
  }

  isEventLoopActive(): boolean {
    return this.eventLoopActive;
  }

  getFlushState(): { flushedThisCycle: boolean; lastFlushTimestamp: number } {
    return {
      flushedThisCycle: this.flushedThisCycle,
      lastFlushTimestamp: this.lastFlushTimestamp,
    };
  }

  getCompactionStats(): {
    count: number;
    history: CompactionRecord[];
    pending: CompactionRecord | null;
    loopFailures: number;
  } {
    // A "failure" is a compaction where loopRestarted stayed false
    // (pending compaction also counts as potentially failed if old enough)
    const failures = this.compactionHistory.filter(c => !c.loopRestarted).length;
    return {
      count: this.compactionCount,
      history: [...this.compactionHistory, ...(this.pendingCompaction ? [this.pendingCompaction] : [])],
      pending: this.pendingCompaction,
      loopFailures: failures,
    };
  }
}
