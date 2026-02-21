// CRC: crc-HomarUScc.md | Seq: seq-startup.md, seq-event-flow.md, seq-shutdown.md
// HomarUScc — Event loop orchestrator (fork of homarus.ts)
import { v4 as uuid } from "uuid";
import type { Event, ConfigData, Logger, MessagePayload } from "./types.js";
import { Config } from "./config.js";
import { EventBus } from "./event-bus.js";
import { EventQueue } from "./event-queue.js";
import { SkillManager } from "./skill-manager.js";
import { ChannelManager } from "./channel-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { MemoryIndex } from "./memory-index.js";
import { IdentityManager } from "./identity-manager.js";
import { TimerService } from "./timer-service.js";
import { BrowserService } from "./browser-service.js";
import { createEmbeddingProvider } from "./embedding-provider.js";
import { registerBuiltinTools } from "./tools/index.js";
import { TranscriptLogger } from "./transcript-logger.js";

export type LoopState = "starting" | "running" | "stopping" | "stopped";

export interface PendingEvent {
  event: Event;
  timestamp: number;
}

export class HomarUScc {
  private state: LoopState = "stopped";
  private config: Config;
  private eventBus: EventBus;
  private eventQueue: EventQueue;
  private skillManager!: SkillManager;
  private channelManager: ChannelManager;
  private toolRegistry: ToolRegistry;
  private memoryIndex: MemoryIndex;
  private identityManager: IdentityManager;
  private timerService!: TimerService;
  private browserService?: BrowserService;
  private transcriptLogger?: TranscriptLogger;
  private logger: Logger;
  private processInterval: ReturnType<typeof setInterval> | null = null;
  private eventHistory: Event[] = [];
  private maxEventHistory = 100;
  private eventWaiters: Set<{ resolve: (events: Event[]) => void; since: number }> = new Set();

  // MCP notification callback — called when events need Claude Code's attention
  private notifyFn: ((event: Event) => void) | null = null;

  constructor(logger: Logger, configPath?: string) {
    this.logger = logger;
    this.config = new Config(logger, configPath);
    this.eventBus = new EventBus(logger);
    this.eventQueue = new EventQueue(logger);
    this.toolRegistry = new ToolRegistry(logger);
    this.memoryIndex = new MemoryIndex(logger);
    this.channelManager = new ChannelManager(logger);
    this.identityManager = new IdentityManager(logger, "", "");
  }

  getState(): LoopState {
    return this.state;
  }

  getConfig(): Config {
    return this.config;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getMemoryIndex(): MemoryIndex {
    return this.memoryIndex;
  }

  getIdentityManager(): IdentityManager {
    return this.identityManager;
  }

  getTimerService(): TimerService {
    return this.timerService;
  }

  getChannelManager(): ChannelManager {
    return this.channelManager;
  }

  getEventHistory(): Event[] {
    return this.eventHistory;
  }

  getSkillManager(): SkillManager {
    return this.skillManager;
  }

  getTranscriptLogger(): TranscriptLogger | undefined {
    return this.transcriptLogger;
  }

  getBrowserService(): BrowserService | undefined {
    return this.browserService;
  }

  // Set the MCP notification callback
  setNotifyFn(fn: (event: Event) => void): void {
    this.notifyFn = fn;
  }

  emit(event: Event): void {
    this.eventQueue.enqueue(event);
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }
    // Signal any blocked wait_for_event calls
    for (const waiter of this.eventWaiters) {
      waiter.resolve(this.getEventsSince(waiter.since));
      this.eventWaiters.delete(waiter);
    }
  }

  waitForEvent(timeoutMs = 30000): Promise<Event[]> {
    const now = Date.now();
    // If there are already very recent events, return immediately
    const recent = this.getEventsSince(now - 100);
    if (recent.length > 0) return Promise.resolve(recent);

    // Otherwise block until emit() signals us or timeout
    return new Promise((resolve) => {
      const waiter = { resolve, since: now };
      this.eventWaiters.add(waiter);
      setTimeout(() => {
        this.eventWaiters.delete(waiter);
        resolve([]); // timeout returns empty — caller loops again
      }, Math.min(timeoutMs, 120000));
    });
  }

  private getEventsSince(since: number): Event[] {
    return this.eventHistory.filter(e => e.timestamp > since);
  }

  registerHandler(eventType: string, handler: (event: Event) => void | Promise<void>): void {
    this.eventBus.registerDirect(eventType, handler);
  }

  async start(): Promise<void> {
    this.state = "starting";
    this.logger.info("HomarUScc starting...");

    // 1. Load config
    const configData = this.config.load();

    // 2. Identity
    const identityDir = configData.identity?.dir ?? "";
    const workspaceDir = configData.identity?.workspaceDir ?? "";
    this.identityManager = new IdentityManager(this.logger, identityDir, workspaceDir);
    if (identityDir) this.identityManager.load();

    // 3. Memory
    const home = process.env.HOME ?? ".";
    const memoryConfig = configData.memory;
    if (memoryConfig?.decay) {
      this.memoryIndex.setDecayConfig(memoryConfig.decay);
    }
    if (memoryConfig?.search) {
      this.memoryIndex.setSearchConfig(memoryConfig.search);
    }
    if (memoryConfig?.dreams) {
      this.memoryIndex.setDreamConfig(memoryConfig.dreams);
    }
    if (memoryConfig?.embedding) {
      const embeddingProvider = createEmbeddingProvider({
        provider: memoryConfig.embedding.provider,
        model: memoryConfig.embedding.model,
        baseUrl: memoryConfig.embedding.baseUrl,
        apiKey: memoryConfig.embedding.apiKey,
        dimensions: memoryConfig.embedding.dimensions,
      }, this.logger);
      this.memoryIndex.setEmbeddingProvider(embeddingProvider);

      const dbPath = `${home}/.homaruscc/memory/index.sqlite`;
      try {
        await this.memoryIndex.initialize(dbPath);
        if (memoryConfig.extraPaths) {
          for (const p of memoryConfig.extraPaths) {
            await this.memoryIndex.indexDirectory(p);
          }
        }
      } catch (err) {
        this.logger.warn("Memory initialization failed", { error: String(err) });
      }
    }

    // 3b. Transcript logger
    if (memoryConfig?.transcripts?.enabled !== false) {
      this.transcriptLogger = new TranscriptLogger(this.logger, this.memoryIndex, memoryConfig?.transcripts);
      this.transcriptLogger.start();
      this.registerHandler("message", (event) => {
        this.transcriptLogger?.logInbound(event);
      });
    }

    // 4. Browser service (lazy — browser only launches on first tool use)
    if (configData.browser?.enabled) {
      this.browserService = new BrowserService(this.logger, configData.browser);
      this.logger.info("Browser service enabled");
    }

    // 5. Register built-in tools
    registerBuiltinTools(this.toolRegistry, this.memoryIndex, this.logger, this.browserService);

    // 6. Load tool policies from config
    if (configData.toolPolicies) {
      for (const p of configData.toolPolicies) {
        this.toolRegistry.addPolicy(p);
        this.logger.info("Loaded tool policy", { name: p.name });
      }
    }

    // 7. Skill manager
    this.skillManager = new SkillManager(
      this.logger,
      this.eventBus,
      this.toolRegistry,
      configData.skills?.paths ?? [],
    );
    this.skillManager.setLoopEmitter((e) => this.emit(e));
    await this.skillManager.loadAll();

    // 8. Timer service
    const timerStore = configData.timers?.store ?? `${home}/.homaruscc/timers.json`;
    this.timerService = new TimerService(this.logger, timerStore);
    this.timerService.setEmitter((e) => this.emit(e));
    this.timerService.loadTimers();
    if (configData.timers?.enabled !== false) {
      this.timerService.start();
    }

    // 9. Channels
    this.channelManager.setEventHandler((e) => this.emit(e));
    this.channelManager.loadAdapters(configData.channels);
    await this.channelManager.connectAll();

    // 10. Register default handlers — route events to MCP notifications
    this.registerDefaultHandlers();

    // 11. Config hot-reload
    this.config.startWatching((safe) => {
      if (safe) this.logger.info("Config hot-reloaded");
    });

    // 12. Start event processing loop
    this.state = "running";
    this.startProcessing();
    this.logger.info("HomarUScc running");
  }

  async stop(): Promise<void> {
    if (this.state === "stopped") return;
    this.state = "stopping";
    this.logger.info("HomarUScc stopping...");

    this.stopProcessing();
    // Resolve any blocked waiters with empty result
    for (const waiter of this.eventWaiters) {
      waiter.resolve([]);
    }
    this.eventWaiters.clear();
    this.config.stopWatching();
    this.timerService.stop();
    await this.browserService?.stop();
    await this.channelManager.disconnectAll();
    await this.skillManager.stopAll();
    this.skillManager.stopWatching();
    await this.transcriptLogger?.stop();
    this.memoryIndex.stopWatching();

    const remaining = this.eventQueue.clear();
    if (remaining.length > 0) {
      this.logger.info("Drained remaining events", { count: remaining.length });
    }

    this.state = "stopped";
    this.logger.info("HomarUScc stopped");
  }

  private async processEvent(event: Event): Promise<void> {
    const handlers = this.eventBus.getHandlers(event.type);

    // Execute direct handlers
    for (const handler of handlers.direct) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error("Direct handler failed", { eventType: event.type, error: String(err) });
      }
    }

    // In HomarUScc, agent handlers are replaced by MCP notifications.
    // Any event with agent handlers or unhandled messages get forwarded to Claude Code.
    if (handlers.agent.length > 0 || !handlers.direct.length) {
      this.notifyFn?.(event);
    }
  }

  private startProcessing(): void {
    this.processInterval = setInterval(() => {
      const event = this.eventQueue.dequeue();
      if (!event || this.state !== "running") return;
      this.processEvent(event).catch((err) =>
        this.logger.error("Event processing error", { error: String(err) })
      );
    }, 50);
  }

  private stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  private registerDefaultHandlers(): void {
    // Forward all messages to Claude Code via MCP notification
    this.registerHandler("message", (event) => {
      this.notifyFn?.(event);
    });

    // Forward timer events to Claude Code
    this.registerHandler("timer_fired", (event) => {
      this.notifyFn?.(event);
    });
  }

  getStatus(): Record<string, unknown> {
    return {
      state: this.state,
      queue: { size: this.eventQueue.size() },
      channels: this.channelManager.healthCheck(),
      skills: this.skillManager?.getAll().map((s) => ({
        name: s.manifest.name,
        state: s.getState(),
      })) ?? [],
      memory: this.memoryIndex.getStats(),
      timers: this.timerService?.getAll().length ?? 0,
      eventHistory: this.eventHistory.length,
    };
  }
}
