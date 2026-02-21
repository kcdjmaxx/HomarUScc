// CRC: crc-AgentRegistry.md | Seq: seq-agent-dispatch.md, seq-agent-poll.md
import { randomUUID } from "node:crypto";
import { statSync, openSync, readSync, closeSync } from "node:fs";
import type { Event, Logger } from "./types.js";

export type AgentStatus = "running" | "completed" | "failed";

export interface AgentEntry {
  id: string;
  description: string;
  status: AgentStatus;
  startTime: number;
  outputFile?: string;
  result?: string;
  error?: string;
}

// R156: Completion markers found in Task agent JSONL output
const COMPLETION_MARKERS = ['"stop_reason":"end_turn"', '"type":"result"'];

// R156: Stable mtime threshold (ms) — file unchanged for this long is considered complete
const STABLE_THRESHOLD_MS = 10_000;

// R156: Number of bytes to read from file tail for marker detection
const TAIL_BYTES = 512;

export class AgentRegistry {
  private agents = new Map<string, AgentEntry>();
  private maxConcurrent: number;
  private emitFn: ((event: Event) => void) | null = null;
  private logger: Logger;
  // R155: Configurable poll interval
  private pollIntervalMs: number;
  // R159: Global poll timer handle
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logger: Logger, maxConcurrent = 3, pollIntervalMs = 5000) {
    this.logger = logger;
    this.maxConcurrent = maxConcurrent;
    this.pollIntervalMs = pollIntervalMs;
  }

  setEmitter(fn: (event: Event) => void): void {
    this.emitFn = fn;
  }

  register(id: string, description: string, outputFile?: string): boolean {
    const active = this.getActiveCount();
    if (active >= this.maxConcurrent) {
      this.logger.warn("Agent registry at capacity", { active, max: this.maxConcurrent });
      return false;
    }

    this.agents.set(id, {
      id,
      description,
      status: "running",
      startTime: Date.now(),
      outputFile,
    });

    this.logger.info("Agent registered", { id, description });
    return true;
  }

  getAll(): AgentEntry[] {
    return Array.from(this.agents.values());
  }

  get(id: string): AgentEntry | null {
    return this.agents.get(id) ?? null;
  }

  // R157, R162: Complete only if still running (prevents duplicate events)
  complete(id: string, result: string): void {
    const agent = this.resolve(id);
    if (!agent) return;
    if (agent.status !== "running") return;

    agent.status = "completed";
    agent.result = result;

    this.emit("agent_completed", id, agent.description, { result });
    this.logger.info("Agent completed", { id, description: agent.description });
  }

  fail(id: string, error: string): void {
    const agent = this.resolve(id);
    if (!agent) return;

    agent.status = "failed";
    agent.error = error;

    this.emit("agent_failed", id, agent.description, { error });
    this.logger.warn("Agent failed", { id, error });
  }

  // R160: Cleanup removes agent and any associated polling state
  cleanup(id: string): void {
    this.agents.delete(id);
  }

  getAvailableSlots(): number {
    return Math.max(0, this.maxConcurrent - this.getActiveCount());
  }

  getActiveCount(): number {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.status === "running") count++;
    }
    return count;
  }

  // R159: Start global polling interval
  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAgents(), this.pollIntervalMs);
    // Unref so the timer does not keep the process alive during shutdown
    if (this.pollTimer && typeof this.pollTimer === "object" && "unref" in this.pollTimer) {
      this.pollTimer.unref();
    }
    this.logger.info("Agent completion polling started", { intervalMs: this.pollIntervalMs });
  }

  // R159: Stop global polling interval
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.logger.info("Agent completion polling stopped");
    }
  }

  // R154, R158: Poll all running agents with outputFiles for completion
  pollAgents(): void {
    for (const agent of this.agents.values()) {
      // R158: Only poll running agents with an outputFile
      if (agent.status !== "running" || !agent.outputFile) continue;

      try {
        this.checkAgentFile(agent);
      } catch (err) {
        // R161: Log and skip on errors
        this.logger.debug("Poll check error for agent", {
          id: agent.id,
          error: String(err),
        });
      }
    }
  }

  private checkAgentFile(agent: AgentEntry): void {
    // R161: statSync may throw ENOENT if file does not exist yet
    let stat;
    try {
      stat = statSync(agent.outputFile!);
    } catch {
      return; // File does not exist yet — skip
    }

    // Skip empty files
    if (stat.size === 0) return;

    // R156: Read the tail of the file
    const tail = this.readTail(agent.outputFile!, stat.size);
    if (!tail) return;

    // R156: Check for completion markers in the tail
    const hasMarker = COMPLETION_MARKERS.some((m) => tail.includes(m));

    if (hasMarker) {
      this.logger.info("Detected completion marker in agent output", { id: agent.id });
      this.complete(agent.id, this.extractSummary(tail));
      return;
    }

    // R156: Check for stable mtime (no writes in STABLE_THRESHOLD_MS)
    const age = Date.now() - stat.mtimeMs;
    if (age >= STABLE_THRESHOLD_MS) {
      this.logger.info("Detected stable output file for agent", {
        id: agent.id,
        stableForMs: Math.round(age),
      });
      this.complete(agent.id, this.extractSummary(tail));
    }
  }

  // Read the last `count` bytes of a file as a UTF-8 string
  private readTail(filePath: string, fileSize: number): string | null {
    const readSize = Math.min(TAIL_BYTES, fileSize);
    const offset = fileSize - readSize;
    const buf = Buffer.alloc(readSize);

    let fd: number | null = null;
    try {
      fd = openSync(filePath, "r");
      readSync(fd, buf, 0, readSize, offset);
      return buf.toString("utf-8");
    } catch {
      return null;
    } finally {
      if (fd !== null) {
        try { closeSync(fd); } catch { /* ignore */ }
      }
    }
  }

  // Extract a brief summary from the file tail for the completion result
  private extractSummary(tail: string): string {
    // Try to find the last JSON line that looks like a result
    const lines = tail.split("\n").filter((l) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    // Truncate to a reasonable length for the event payload
    if (lastLine.length > 200) {
      return lastLine.slice(0, 200) + "...";
    }
    return lastLine || "(output file completed)";
  }

  private resolve(id: string): AgentEntry | null {
    const agent = this.agents.get(id);
    if (!agent) {
      this.logger.warn("Unknown agent", { id });
      return null;
    }
    return agent;
  }

  private emit(
    type: string,
    agentId: string,
    description: string,
    extra: Record<string, string>,
  ): void {
    this.emitFn?.({
      id: randomUUID(),
      type,
      source: `agent:${agentId}`,
      timestamp: Date.now(),
      payload: { agentId, description, ...extra },
    });
  }
}
