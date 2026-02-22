// CRC: crc-AgentRegistry.md | Seq: seq-agent-dispatch.md
import { randomUUID } from "node:crypto";
import type { Event, Logger } from "./types.js";

export type AgentStatus = "running" | "completed" | "failed" | "timeout";

export interface AgentEntry {
  id: string;
  description: string;
  status: AgentStatus;
  startTime: number;
  result?: string;
  error?: string;
}

// Default timeout: 30 minutes
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
// How often to check for timed-out agents
const TIMEOUT_CHECK_INTERVAL_MS = 60_000;

export class AgentRegistry {
  private agents = new Map<string, AgentEntry>();
  private maxConcurrent: number;
  private emitFn: ((event: Event) => void) | null = null;
  private logger: Logger;
  private timeoutMs: number;
  private timeoutTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logger: Logger, maxConcurrent = 3, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.logger = logger;
    this.maxConcurrent = maxConcurrent;
    this.timeoutMs = timeoutMs;
  }

  setEmitter(fn: (event: Event) => void): void {
    this.emitFn = fn;
  }

  register(id: string, description: string): boolean {
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
    });

    this.logger.info("Agent registered", { id, description });

    // Start timeout checker if not already running
    if (!this.timeoutTimer) {
      this.startTimeoutChecker();
    }

    return true;
  }

  getAll(): AgentEntry[] {
    return Array.from(this.agents.values());
  }

  get(id: string): AgentEntry | null {
    return this.agents.get(id) ?? null;
  }

  // Called via POST /api/agents/:id/complete callback from the agent itself
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
    if (agent.status !== "running") return;

    agent.status = "failed";
    agent.error = error;

    this.emit("agent_failed", id, agent.description, { error });
    this.logger.warn("Agent failed", { id, error });
  }

  cleanup(id: string): void {
    this.agents.delete(id);
    // Stop timeout checker if no agents remain
    if (this.getActiveCount() === 0) {
      this.stopTimeoutChecker();
    }
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

  // Periodic check for agents that have exceeded the timeout
  private startTimeoutChecker(): void {
    if (this.timeoutTimer) return;
    this.timeoutTimer = setInterval(() => this.checkTimeouts(), TIMEOUT_CHECK_INTERVAL_MS);
    if (this.timeoutTimer && typeof this.timeoutTimer === "object" && "unref" in this.timeoutTimer) {
      this.timeoutTimer.unref();
    }
  }

  private stopTimeoutChecker(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  stop(): void {
    this.stopTimeoutChecker();
  }

  private checkTimeouts(): void {
    const now = Date.now();
    for (const agent of this.agents.values()) {
      if (agent.status !== "running") continue;
      const elapsed = now - agent.startTime;
      if (elapsed >= this.timeoutMs) {
        agent.status = "timeout";
        agent.error = `Agent timed out after ${Math.round(elapsed / 60_000)}m`;
        this.emit("agent_timeout", agent.id, agent.description, { error: agent.error });
        this.logger.warn("Agent timed out", { id: agent.id, elapsedMs: elapsed });
      }
    }
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
