// CRC: crc-AgentRegistry.md | Seq: seq-agent-dispatch.md
import { randomUUID } from "node:crypto";
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

export class AgentRegistry {
  private agents = new Map<string, AgentEntry>();
  private maxConcurrent: number;
  private emitFn: ((event: Event) => void) | null = null;
  private logger: Logger;

  constructor(logger: Logger, maxConcurrent = 3) {
    this.logger = logger;
    this.maxConcurrent = maxConcurrent;
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

  complete(id: string, result: string): void {
    const agent = this.resolve(id);
    if (!agent) return;

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
