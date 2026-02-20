// Event routing — from HomarUS
import type { Event, DirectHandler, AgentHandlerConfig, Logger } from "./types.js";

export interface HandlerSet {
  direct: DirectHandler[];
  agent: AgentHandlerConfig[];
}

export class EventBus {
  private directHandlers = new Map<string, DirectHandler[]>();
  private agentHandlers = new Map<string, AgentHandlerConfig[]>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  registerDirect(eventType: string, handler: DirectHandler): void {
    const handlers = this.directHandlers.get(eventType) ?? [];
    handlers.push(handler);
    this.directHandlers.set(eventType, handlers);
    this.logger.debug("Registered direct handler", { eventType });
  }

  registerAgent(eventType: string, config: AgentHandlerConfig): void {
    const handlers = this.agentHandlers.get(eventType) ?? [];
    handlers.push(config);
    this.agentHandlers.set(eventType, handlers);
    this.logger.debug("Registered agent handler", { eventType, handlerId: config.id });
  }

  unregister(eventType: string, handlerId: string): void {
    const agents = this.agentHandlers.get(eventType);
    if (agents) {
      this.agentHandlers.set(
        eventType,
        agents.filter((a) => a.id !== handlerId),
      );
    }
  }

  getHandlers(eventType: string): HandlerSet {
    return {
      direct: this.directHandlers.get(eventType) ?? [],
      agent: this.agentHandlers.get(eventType) ?? [],
    };
  }

  hasHandlers(eventType: string): boolean {
    const { direct, agent } = this.getHandlers(eventType);
    return direct.length > 0 || agent.length > 0;
  }

  clear(): void {
    this.directHandlers.clear();
    this.agentHandlers.clear();
  }
}
