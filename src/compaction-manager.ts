// CRC: crc-CompactionManager.md | Seq: seq-compaction-flush.md
// Auto-flush before context compaction — from HomarUS
import { randomUUID } from "node:crypto";
import type { Logger } from "./types.js";
import type { HomarUScc } from "./homaruscc.js";

export class CompactionManager {
  private flushedThisCycle = false;
  private lastFlushTimestamp = 0;
  private logger: Logger;
  private loop: HomarUScc;

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

    // R128: Save checkpoint before compaction
    const checkpoint = this.loop.getSessionCheckpoint();
    checkpoint.update({ modifiedFiles: [] }); // trigger timestamp update

    return [
      "IMPORTANT: Context compaction is about to occur. Save any important session state to memory NOW.",
      "Use the memory_store tool to persist anything valuable from this session that hasn't been saved yet.",
      "",
      "What to save:",
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
    ].join("\n");
  }

  handlePostCompact(): string {
    this.flushedThisCycle = false;

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
      lines.push("", "--- Session Checkpoint (what you were doing before compaction) ---", checkpointText);
    }

    // Include active agents
    const agents = this.loop.getAgentRegistry().getAll().filter(a => a.status === "running");
    if (agents.length > 0) {
      lines.push("", "Running background agents:");
      for (const a of agents) {
        lines.push(`  - ${a.id}: ${a.description} (started ${new Date(a.startTime).toISOString()})`);
      }
    }

    return lines.join("\n");
  }

  getFlushState(): { flushedThisCycle: boolean; lastFlushTimestamp: number } {
    return {
      flushedThisCycle: this.flushedThisCycle,
      lastFlushTimestamp: this.lastFlushTimestamp,
    };
  }
}
