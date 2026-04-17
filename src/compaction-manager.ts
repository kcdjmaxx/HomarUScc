// CRC: crc-CompactionManager.md | Seq: seq-compaction-flush.md
// Auto-flush before context compaction — from HomarUS
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { Logger } from "./types.js";
import type { HomarUScc } from "./homaruscc.js";

export interface CompactionRecord {
  timestamp: number;
  loopRestarted: boolean; // Did /api/wait get called after this compaction?
}

export class CompactionManager {
  private flushedThisCycle = false;
  private lastFlushTimestamp = 0;
  private compactedSinceLastWake = false; // R150: track compaction for digest vs full delivery
  private logger: Logger;
  private loop: HomarUScc;

  // Compaction debug counter — persisted across backend restarts
  private compactionCount = 0;
  private compactionHistory: CompactionRecord[] = [];
  private pendingCompaction: CompactionRecord | null = null;
  private static readonly COUNTER_FILE = join(homedir(), ".homaruscc", "compaction-count.json");
  private static readonly MAX_COMPACTIONS = 8; // Auto-restart threshold

  // Event loop tracking — set true on first /api/wait call, stays true forever
  private eventLoopActive = false;

  constructor(loop: HomarUScc, logger: Logger) {
    this.loop = loop;
    this.logger = logger;
    this.compactionCount = this.loadCount();
  }

  private loadCount(): number {
    try {
      const data = JSON.parse(readFileSync(CompactionManager.COUNTER_FILE, "utf-8"));
      return typeof data.count === "number" ? data.count : 0;
    } catch {
      return 0;
    }
  }

  resetCount(): void {
    this.compactionCount = 0;
    this.compactionHistory = [];
    this.pendingCompaction = null;
    this.saveCount();
    this.logger.info("Compaction counter reset to 0");
  }

  private saveCount(): void {
    try {
      mkdirSync(dirname(CompactionManager.COUNTER_FILE), { recursive: true });
      writeFileSync(CompactionManager.COUNTER_FILE, JSON.stringify({ count: this.compactionCount }));
    } catch (err) {
      this.logger.warn("Failed to persist compaction count", { error: String(err) });
    }
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
    this.saveCount();
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

  /**
   * Read the last N bytes of today's transcript file for post-compaction context.
   * Returns the tail content or empty string if unavailable.
   */
  private readTranscriptTail(maxBytes = 50_000): string {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const transcriptPath = join(homedir(), ".homaruscc", "transcripts", `${date}.md`);
      if (!existsSync(transcriptPath)) return "";

      const stat = statSync(transcriptPath);
      const size = stat.size;
      if (size === 0) return "";

      const readSize = Math.min(size, maxBytes);
      const offset = size - readSize;
      const buf = Buffer.alloc(readSize);
      const fd = openSync(transcriptPath, "r");
      readSync(fd, buf, 0, readSize, offset);
      closeSync(fd);

      let content = buf.toString("utf-8");
      // If we started mid-file, skip to the first complete section header
      if (offset > 0) {
        const firstHeader = content.indexOf("\n## ");
        if (firstHeader >= 0) {
          content = content.slice(firstHeader + 1);
        }
      }
      return content;
    } catch (err) {
      this.logger.warn("Failed to read transcript tail for post-compaction", { error: String(err) });
      return "";
    }
  }

  /**
   * Read recent memory entries with their content for post-compaction context.
   */
  private readRecentMemoryContent(limit = 10): string[] {
    try {
      const recentPaths = this.loop.getMemoryIndex().getRecentPaths(limit);
      const entries: string[] = [];
      for (const p of recentPaths) {
        try {
          const content = readFileSync(p, "utf-8").trim();
          // Truncate very long memories to keep injection reasonable
          const truncated = content.length > 500 ? content.slice(0, 500) + "..." : content;
          entries.push(`[${p}]\n${truncated}`);
        } catch {
          entries.push(`[${p}] (file not readable)`);
        }
      }
      return entries;
    } catch {
      return [];
    }
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

    this.logger.info("Post-compact context re-injection (enriched)");

    const timerNames = this.loop.getTimerService().getAll().map((t) => `${t.name} (${t.type})`);
    const memoryStats = this.loop.getMemoryIndex().getStats();
    const watermark = this.loop.getDeliveryWatermark();
    const recentEvents = this.loop.getEventHistory().slice(-25);

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

    if (this.loop.getIdentityManager().getSoul()) {
      lines.push("Identity: soul.md and user.md are loaded");
    }

    // Enriched: recent events with fuller payloads (25 events, 300 char payloads)
    if (recentEvents.length > 0) {
      lines.push("", `Last ${recentEvents.length} events (already handled — do NOT re-process):`);
      for (const e of recentEvents) {
        const ts = new Date(e.timestamp).toISOString();
        const summary = JSON.stringify(e.payload).slice(0, 300);
        lines.push(`  [${ts}] ${e.type}/${e.source}: ${summary}`);
      }
    }

    // Enriched: recent memory content (not just paths)
    const memoryEntries = this.readRecentMemoryContent(15);
    if (memoryEntries.length > 0) {
      lines.push("", "--- Recent Memory Entries (content) ---");
      for (const entry of memoryEntries) {
        lines.push(entry, "");
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

    // Enriched: transcript tail — last ~50KB of today's conversation for continuity
    const transcriptTail = this.readTranscriptTail(50_000);
    if (transcriptTail) {
      lines.push(
        "",
        "--- Recent Transcript (raw conversation for continuity) ---",
        "The following is the tail of today's transcript. Use it to understand the flow",
        "of conversation and pick up where you left off naturally.",
        "",
        transcriptTail,
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

  shouldAutoRestart(): boolean {
    return this.compactionCount >= CompactionManager.MAX_COMPACTIONS;
  }
}
