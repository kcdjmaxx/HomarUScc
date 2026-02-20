// Channel adapter base — from HomarUS (removed CLIChannelAdapter, not needed for MCP)
import { v4 as uuid } from "uuid";
import type {
  Event, MessagePayload, OutboundMessage, DmPolicy, GroupPolicy, HealthStatus, Logger,
} from "./types.js";

export type AdapterState = "disconnected" | "connecting" | "connected" | "error";

export abstract class ChannelAdapter {
  readonly name: string;
  protected state: AdapterState = "disconnected";
  protected dmPolicy: DmPolicy;
  protected groupPolicy: GroupPolicy;
  protected logger: Logger;
  private messageHandler: ((event: Event) => void) | null = null;

  constructor(name: string, logger: Logger, dmPolicy: DmPolicy = "open", groupPolicy: GroupPolicy = "mention_required") {
    this.name = name;
    this.logger = logger;
    this.dmPolicy = dmPolicy;
    this.groupPolicy = groupPolicy;
  }

  getState(): AdapterState {
    return this.state;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(target: string, message: OutboundMessage): Promise<void>;
  abstract health(): HealthStatus;

  onMessage(handler: (event: Event) => void): void {
    this.messageHandler = handler;
  }

  protected normalizeInbound(payload: MessagePayload, target?: string): Event {
    const source = target ? `channel:${this.name}:${target}` : `channel:${this.name}`;
    return {
      id: uuid(),
      type: "message",
      source,
      timestamp: Date.now(),
      payload,
    };
  }

  protected checkAccess(payload: MessagePayload): boolean {
    if (payload.isGroup) {
      if (this.groupPolicy === "disabled") return false;
      if (this.groupPolicy === "mention_required" && !payload.isMention) return false;
      return true;
    }
    if (this.dmPolicy === "disabled") return false;
    return true;
  }

  protected deliver(payload: MessagePayload): void {
    if (!this.checkAccess(payload)) {
      this.logger.debug("Message rejected by policy", { channel: this.name, from: payload.from });
      return;
    }
    const event = this.normalizeInbound(payload);
    this.messageHandler?.(event);
  }

  protected deliverWithTarget(payload: MessagePayload, target: string): void {
    if (!this.checkAccess(payload)) {
      this.logger.debug("Message rejected by policy", { channel: this.name, from: payload.from });
      return;
    }
    const event = this.normalizeInbound(payload, target);
    this.messageHandler?.(event);
  }
}
