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
import { SessionCheckpoint } from "./session-checkpoint.js";
import { AgentRegistry } from "./agent-registry.js";
import { FactExtractor } from "./fact-extractor.js";
import { SessionExtractor } from "./session-extractor.js";
import { DocsIndex } from "./docs-index.js";
import { ConflictMonitor } from "./conflict-monitor.js";
// VaultIndex and UnifiedSearch live in local/vault-indexer/ (gitignored)
// Loaded dynamically at runtime if vault config is present

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
  private sessionCheckpoint!: SessionCheckpoint;
  private agentRegistry!: AgentRegistry;
  private factExtractor?: FactExtractor;
  private sessionExtractor?: SessionExtractor;
  private docsIndex?: DocsIndex;
  private conflictMonitor: ConflictMonitor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vaultIndex?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private unifiedSearch?: any;
  private logger: Logger;
  private processInterval: ReturnType<typeof setInterval> | null = null;
  private eventHistory: Event[] = [];
  private maxEventHistory = 100;
  private eventWaiters: Set<{ resolve: (events: Event[]) => void; since: number }> = new Set();
  private deliveryWatermark = 0; // timestamp of the last event delivered via waitForEvent/API

  // MCP notification callback — called when events need Claude Code's attention
  private notifyFn: ((event: Event) => void) | null = null;

  constructor(logger: Logger, configPath?: string) {
    this.logger = logger;
    this.config = new Config(logger, configPath);
    this.eventBus = new EventBus(logger);
    this.eventQueue = new EventQueue(logger);
    this.toolRegistry = new ToolRegistry(logger);
    this.memoryIndex = new MemoryIndex(logger);
    this.conflictMonitor = new ConflictMonitor(logger);
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

  getDocsIndex(): DocsIndex | undefined {
    return this.docsIndex;
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

  getSessionCheckpoint(): SessionCheckpoint {
    return this.sessionCheckpoint;
  }

  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  getFactExtractor(): FactExtractor | undefined {
    return this.factExtractor;
  }

  getSessionExtractor(): SessionExtractor | undefined {
    return this.sessionExtractor;
  }

  getConflictMonitor(): ConflictMonitor {
    return this.conflictMonitor;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVaultIndex(): any | undefined {
    return this.vaultIndex;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUnifiedSearch(): any | undefined {
    return this.unifiedSearch;
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

  waitForEvent(timeoutMs = 30000, since?: number): Promise<Event[]> {
    // Use explicit cursor if provided, otherwise use delivery watermark, otherwise now
    const cursor = since ?? (this.deliveryWatermark || Date.now());
    // If there are already events after the cursor, return immediately
    const pending = this.getEventsSince(cursor);
    if (pending.length > 0) {
      this.advanceWatermark(pending);
      return Promise.resolve(pending);
    }

    // Otherwise block until emit() signals us or timeout
    return new Promise((resolve) => {
      const waiter = {
        resolve: (events: Event[]) => {
          this.advanceWatermark(events);
          resolve(events);
        },
        since: cursor,
      };
      this.eventWaiters.add(waiter);
      setTimeout(() => {
        this.eventWaiters.delete(waiter);
        resolve([]); // timeout returns empty — caller loops again
      }, Math.min(timeoutMs, 120000));
    });
  }

  private advanceWatermark(events: Event[]): void {
    if (events.length === 0) return;
    const maxTs = Math.max(...events.map(e => e.timestamp));
    if (maxTs > this.deliveryWatermark) {
      this.deliveryWatermark = maxTs;
    }
  }

  getDeliveryWatermark(): number {
    return this.deliveryWatermark;
  }

  private getEventsSince(since: number): Event[] {
    const fromHistory = this.eventHistory.filter(e => e.timestamp > since);
    // Replay missed timer events that fell out of the capped history
    if (this.timerService) {
      const knownSources = new Set(fromHistory.filter(e => e.type === "timer_fired").map(e => e.source));
      const missed = this.timerService.getUndeliveredFires(since, knownSources);
      if (missed.length > 0) {
        this.logger.info("Replaying missed timer events", { count: missed.length, names: missed.map(e => (e.payload as Record<string, unknown>)?.name) });
        return [...fromHistory, ...missed].sort((a, b) => a.timestamp - b.timestamp);
      }
    }
    return fromHistory;
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
        // Initialize ConflictMonitor with the memory DB
        const memDb = this.memoryIndex.getDb();
        if (memDb) {
          this.conflictMonitor.initialize(memDb);
          this.wireFastLoopAlerts(configData);
        }
        if (memoryConfig.extraPaths) {
          for (const p of memoryConfig.extraPaths) {
            await this.memoryIndex.indexDirectory(p);
          }
        }
      } catch (err) {
        this.logger.warn("Memory initialization failed", { error: String(err) });
      }
    }

    // 3a. Vault index (optional — V34: only if memory.vault config section present)
    // VaultIndex/UnifiedSearch are in local/vault-indexer/ (gitignored), loaded dynamically
    const vaultConfig = memoryConfig?.vault;
    if (vaultConfig?.vaultPath) {
      try {
        const vaultDistPath = new URL("../local/vault-indexer/dist/", import.meta.url).pathname;
        const { VaultIndex } = await import(`${vaultDistPath}vault-index.js`);
        const { UnifiedSearch } = await import(`${vaultDistPath}unified-search.js`);

        const vaultDbPath = (vaultConfig.dbPath ?? `${home}/.homaruscc/vault/index.sqlite`)
          .replace(/^~/, home);
        this.vaultIndex = new VaultIndex(this.logger, {
          vaultPath: vaultConfig.vaultPath,
          exclusions: vaultConfig.exclusions,
        });
        if (memoryConfig?.embedding) {
          const vaultEmbeddingProvider = createEmbeddingProvider({
            provider: memoryConfig.embedding.provider,
            model: memoryConfig.embedding.model,
            baseUrl: memoryConfig.embedding.baseUrl,
            apiKey: memoryConfig.embedding.apiKey,
            dimensions: memoryConfig.embedding.dimensions,
          }, this.logger);
          this.vaultIndex.setEmbeddingProvider(vaultEmbeddingProvider);
        }
        await this.vaultIndex.initialize(vaultDbPath);

        // Create UnifiedSearch coordinator
        this.unifiedSearch = new UnifiedSearch(
          this.vaultIndex,
          this.memoryIndex,
          vaultConfig.unifiedWeights,
          this.logger,
        );

        this.logger.info("Vault index enabled", { vaultPath: vaultConfig.vaultPath });
      } catch (err) {
        this.logger.warn("Vault index not available or initialization failed", { error: String(err) });
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

    // 3c. Fact extractor (passive Haiku-based fact extraction from conversations)
    const feCfg = configData.factExtractor;
    if (feCfg !== false) {
      this.factExtractor = new FactExtractor(this.logger, this.memoryIndex, {
        enabled: (typeof feCfg === "object" ? feCfg?.enabled : true) ?? true,
        batchSize: typeof feCfg === "object" ? feCfg?.batchSize : undefined,
        extractionDelayMs: typeof feCfg === "object" ? feCfg?.extractionDelayMs : undefined,
        model: typeof feCfg === "object" ? feCfg?.model : undefined,
      });
      this.registerHandler("message", (event) => {
        const payload = event.payload as MessagePayload;
        this.factExtractor?.addTurn({
          timestamp: event.timestamp,
          direction: "in",
          sender: payload.from,
          text: payload.text,
        });
      });
      this.logger.info("FactExtractor enabled");
    }

    // 3d. Session transcript extractor (extracts insights from Claude Code JSONL logs)
    this.sessionExtractor = new SessionExtractor(this.logger, this.memoryIndex);
    this.logger.info("SessionExtractor initialized");

    // 4. Browser service (lazy — browser only launches on first tool use)
    if (configData.browser?.enabled) {
      this.browserService = new BrowserService(this.logger, configData.browser);
      this.logger.info("Browser service enabled");
    }

    // 4b. Session checkpoint
    const checkpointPath = `${home}/.homaruscc/checkpoint.json`;
    this.sessionCheckpoint = new SessionCheckpoint(this.logger, checkpointPath);
    this.sessionCheckpoint.load();

    // 4c. Agent registry
    const maxConcurrent = configData.agents?.maxConcurrent ?? 3;
    this.agentRegistry = new AgentRegistry(this.logger, maxConcurrent);
    this.agentRegistry.setEmitter((e) => this.emit(e));

    // 4d. Docs index (domain-specific vector DBs)
    this.docsIndex = new DocsIndex(this.logger);
    if (memoryConfig?.embedding) {
      const docsEmbProvider = createEmbeddingProvider({
        provider: memoryConfig.embedding.provider,
        model: memoryConfig.embedding.model,
        baseUrl: memoryConfig.embedding.baseUrl,
        apiKey: memoryConfig.embedding.apiKey,
        dimensions: memoryConfig.embedding.dimensions,
      }, this.logger);
      this.docsIndex.setEmbeddingProvider(docsEmbProvider);
    }
    this.logger.info("DocsIndex initialized");

    // 5. Register built-in tools
    registerBuiltinTools(this.toolRegistry, this.memoryIndex, this.logger, this.browserService, this.docsIndex);

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
    if (configData.timers?.defaults) {
      this.timerService.registerDefaults(configData.timers.defaults);
    }
    if (configData.timers?.enabled !== false) {
      this.timerService.start();
    }

    // 8b. V37, V38, V39: Auto-reindex timer for vault
    if (this.vaultIndex && vaultConfig?.autoReindex) {
      const intervalMs = vaultConfig.reindexIntervalMs ?? 3600000;
      this.timerService.add({
        name: "vault-reindex",
        type: "interval",
        schedule: String(intervalMs),
        prompt: "Vault incremental reindex timer fired. The vault index will be updated automatically.",
      });
      // Register handler to perform incremental reindex when the timer fires
      this.registerHandler("timer_fired", async (event) => {
        const payload = event.payload as { name?: string };
        if (payload?.name === "vault-reindex" && this.vaultIndex) {
          try {
            const stats = await this.vaultIndex.incrementalReindex();
            this.logger.info("Auto vault reindex completed", { ...stats });
          } catch (err) {
            this.logger.warn("Auto vault reindex failed", { error: String(err) });
          }
        }
      });
      this.logger.info("Vault auto-reindex timer registered", { intervalMs });
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
    this.agentRegistry.stop();
    this.timerService.stop();
    await this.browserService?.stop();
    await this.channelManager.disconnectAll();
    await this.skillManager.stopAll();
    this.skillManager.stopWatching();
    await this.transcriptLogger?.stop();
    await this.factExtractor?.flush();
    this.memoryIndex.stopWatching();
    this.docsIndex?.close();
    this.vaultIndex?.close();

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

  /**
   * Wire ACC fast-loop alerts (Step D). Conflicts that breach the severity or
   * burst gate get pushed out as a Telegram message to the configured chat.
   * Default target: first entry in `channels.telegram.allowedChatIds`.
   * Config lives under `acc.alerts` — see types.ts AccConfig.
   */
  private wireFastLoopAlerts(configData: ConfigData): void {
    const alerts = configData.acc?.alerts ?? {};
    if (alerts.enabled === false) {
      this.logger.info("ACC fast-loop alerts disabled by config");
      return;
    }

    this.conflictMonitor.setAlertConfig({
      enabled: alerts.enabled ?? true,
      severityThreshold: alerts.severityThreshold ?? "high",
      burstThreshold: alerts.burstThreshold ?? 3,
      burstWindowMs: alerts.burstWindowMs ?? 10 * 60 * 1000,
      rateLimitMs: alerts.rateLimitMs ?? 60 * 60 * 1000,
    });

    const channelName = alerts.channel ?? "telegram";
    const tgConfig = configData.channels?.[channelName] as { allowedChatIds?: Array<string | number> } | undefined;
    const chatId = alerts.chatId ?? tgConfig?.allowedChatIds?.[0];
    if (chatId === undefined || chatId === null) {
      this.logger.warn("ACC fast-loop alerts: no chatId resolvable — leaving notifier unset");
      return;
    }

    this.conflictMonitor.setFastLoopNotifier(async (alert) => {
      const { gate, conflict, burstCount, burstWindowMs } = alert;
      const header = gate === "severity"
        ? `ACC alert (${conflict.severity}/${conflict.type})`
        : `ACC burst (${burstCount} in ${Math.round((burstWindowMs ?? 0) / 60000)}m)`;
      const body = `${header}\nDomain: ${conflict.domain}\n${conflict.description}`;
      try {
        await this.channelManager.send(channelName, String(chatId), { text: body });
      } catch (err) {
        this.logger.warn("Fast-loop alert send failed", { error: String(err), channel: channelName });
      }
    });

    this.logger.info("ACC fast-loop alerts wired", {
      channel: channelName,
      chatId: String(chatId),
      severityThreshold: this.conflictMonitor.getAlertConfig().severityThreshold,
      burstThreshold: this.conflictMonitor.getAlertConfig().burstThreshold,
    });
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
      vault: this.vaultIndex?.getStats() ?? null,
      docs: this.docsIndex?.listDomains() ?? [],
      timers: this.timerService?.getAll().length ?? 0,
      eventHistory: this.eventHistory.length,
      factExtractor: this.factExtractor?.getStats() ?? null,
      sessionExtractor: this.sessionExtractor?.getStats() ?? null,
    };
  }

  hasActiveConsumer(): boolean {
    return this.eventWaiters.size > 0;
  }
}
