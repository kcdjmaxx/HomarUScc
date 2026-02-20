// Channel manager — adapted from HomarUS (removed CLI adapter, added dashboard)
import type { Event, OutboundMessage, ChannelConfig, HealthStatus, Logger } from "./types.js";
import { ChannelAdapter } from "./channel-adapter.js";
import { TelegramChannelAdapter } from "./telegram-adapter.js";

export class ChannelManager {
  private adapters = new Map<string, ChannelAdapter>();
  private logger: Logger;
  private eventHandler: ((event: Event) => void) | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  setEventHandler(fn: (event: Event) => void): void {
    this.eventHandler = fn;
  }

  loadAdapters(channels: Record<string, ChannelConfig>): void {
    for (const [name, config] of Object.entries(channels)) {
      let adapter: ChannelAdapter;

      switch (name) {
        case "telegram":
          adapter = TelegramChannelAdapter.fromChannelConfig(config, this.logger);
          break;
        default:
          this.logger.warn("Unknown channel type, skipping", { name });
          continue;
      }

      this.adapters.set(name, adapter);
    }
  }

  // Register an externally-created adapter (e.g., dashboard adapter)
  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  async connectAll(): Promise<void> {
    for (const [name, adapter] of this.adapters) {
      try {
        adapter.onMessage((event) => this.eventHandler?.(event));
        await adapter.connect();
      } catch (err) {
        this.logger.error("Failed to connect channel", { name, error: String(err) });
      }
    }
    this.logger.info("Channels connected", { count: this.adapters.size });
  }

  async disconnectAll(): Promise<void> {
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
      } catch (err) {
        this.logger.warn("Error disconnecting channel", { name, error: String(err) });
      }
    }
  }

  async send(channel: string, target: string, message: OutboundMessage): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`Unknown channel: ${channel}`);
    }
    await adapter.send(target, message);
  }

  getAdapter(name: string): ChannelAdapter | undefined {
    return this.adapters.get(name);
  }

  getConnected(): ChannelAdapter[] {
    return [...this.adapters.values()].filter((a) => a.getState() === "connected");
  }

  healthCheck(): Record<string, HealthStatus> {
    const results: Record<string, HealthStatus> = {};
    for (const [name, adapter] of this.adapters) {
      results[name] = adapter.health();
    }
    return results;
  }
}
