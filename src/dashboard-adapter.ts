// Dashboard channel adapter — bridges web dashboard ↔ event loop
import { v4 as uuid } from "uuid";
import type { OutboundMessage, HealthStatus, Logger } from "./types.js";
import { ChannelAdapter } from "./channel-adapter.js";

export type DashboardMessageHandler = (message: { from: string; text: string }) => void;

export class DashboardAdapter extends ChannelAdapter {
  private outboundHandler: ((target: string, message: OutboundMessage) => void) | null = null;

  constructor(logger: Logger) {
    super("dashboard", logger, "open", "always_on");
  }

  async connect(): Promise<void> {
    this.state = "connected";
    this.logger.info("Dashboard adapter connected");
  }

  async disconnect(): Promise<void> {
    this.state = "disconnected";
    this.logger.info("Dashboard adapter disconnected");
  }

  async send(target: string, message: OutboundMessage): Promise<void> {
    // Forward to WebSocket clients via the handler
    this.outboundHandler?.(target, message);
  }

  health(): HealthStatus {
    return {
      healthy: this.state === "connected",
      lastCheck: Date.now(),
    };
  }

  // Called by DashboardServer when WebSocket clients send messages
  receiveFromDashboard(from: string, text: string): void {
    this.deliver({
      from,
      channel: "dashboard",
      text,
      isGroup: false,
      isMention: false,
      raw: { from, text },
    });
  }

  // Set handler for outbound messages to dashboard WebSocket clients
  setOutboundHandler(fn: (target: string, message: OutboundMessage) => void): void {
    this.outboundHandler = fn;
  }
}
