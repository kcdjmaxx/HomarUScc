// CRC: crc-DashboardServer.md | Seq: seq-event-flow.md
// Dashboard server — Express + WebSocket for the web dashboard
import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import type { Logger, Event } from "./types.js";
import type { HomarUScc } from "./homaruscc.js";
import type { DashboardAdapter } from "./dashboard-adapter.js";
import { createMcpTools, type McpToolDef } from "./mcp-tools.js";
import { createMcpResources, type McpResourceDef } from "./mcp-resources.js";
import { CompactionManager } from "./compaction-manager.js";
import { SpacesManager } from "./spaces-manager.js";
import { AppRegistry } from "./app-registry.js";
import { AppDataStore } from "./app-data-store.js";
import { PluginLoader } from "./plugin-loader.js";

interface WsMessage {
  type: "chat" | "search" | "status" | "events" | "agent-chat";
  payload: unknown;
}

interface WsOutbound {
  type: "chat" | "event" | "status" | "search_results" | "error" | "agent-chat";
  payload: unknown;
}

interface AgentChatMessage {
  id: string;
  from: string;      // "caul" | "hal" | external agent name
  text: string;
  timestamp: number;
  replyTo?: string;   // id of message being replied to
}

export class DashboardServer {
  private app: express.Application;
  private httpServer: HttpServer;
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private port: number;
  private logger: Logger;
  private loop: HomarUScc;
  private dashboardAdapter: DashboardAdapter;
  private mcpTools: McpToolDef[];
  private mcpResources: McpResourceDef[];
  private compactionManager: CompactionManager;
  private spacesManager: SpacesManager;
  private appRegistry: AppRegistry;
  private appDataStore: AppDataStore;
  private pluginLoader: PluginLoader;
  private extensionRouteMounts: Array<(app: express.Application) => void> = [];
  private lastWaitPoll = 0;
  private restartChatId: string | null = null;

  constructor(logger: Logger, port: number, loop: HomarUScc, dashboardAdapter: DashboardAdapter) {
    this.logger = logger;
    this.port = port;
    this.loop = loop;
    this.dashboardAdapter = dashboardAdapter;
    // mcpTools is populated in start() so personal extensions have a chance to
    // register additional tools (via loop.registerExtraMcpTool) before
    // createMcpTools is invoked.
    this.mcpTools = [];
    this.mcpResources = createMcpResources(loop);
    this.compactionManager = new CompactionManager(loop, logger);

    // R305: Resolve spaces directory from config or default
    const spacesConfig = loop.getConfig().getAll().spaces;
    const projectDir = resolve(import.meta.dirname ?? __dirname, "..");
    const vaultRoot = resolve(projectDir, "../..");
    const spacesDir = spacesConfig?.path ?? join(vaultRoot, "Spaces");
    this.spacesManager = new SpacesManager(spacesDir);

    // CRC: crc-AppRegistry.md | Seq: seq-apps-startup.md
    // R204: App directory from config or default
    const appsConfig = loop.getConfig().getAll() as any;
    const appsDir = appsConfig.dashboard?.apps?.directory ?? join(homedir(), ".homaruscc", "apps");
    this.appRegistry = new AppRegistry(appsDir, logger);
    this.appRegistry.scan();
    this.appDataStore = new AppDataStore(appsDir, this.appRegistry);

    // Plugin loader — discovers plugins from dist/plugins/
    this.pluginLoader = new PluginLoader(projectDir, appsDir, logger);

    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupRoutes();
    this.setupWebSocket();
    this.wireAdapter();
  }

  /**
   * Register a callback that mounts extra Express routes. Called by optional
   * extensions (personal-extensions.ts etc.) during backend startup, before
   * DashboardServer.start() is awaited. Mounted after core + plugin routes
   * but before the catch-all static file handler.
   */
  registerExtensionRoutes(mount: (app: express.Application) => void): void {
    this.extensionRouteMounts.push(mount);
  }

  async start(): Promise<void> {
    // Load plugins (dynamic import requires await)
    await this.pluginLoader.loadAll();
    this.pluginLoader.mountRoutes(this.app);
    // Build the MCP tool list. createMcpTools reads loop.getExtraMcpTools()
    // so any tools registered by personal extensions earlier in startup are
    // included.
    this.mcpTools.push(...createMcpTools(this.loop));
    this.mcpTools.push(...this.pluginLoader.getAllTools());

    // Extension routes — personal/gitignored modules register Express handlers
    // via DashboardServer.registerExtensionRoutes (see HomarUScc for the
    // extension hook). Mounted AFTER plugins but BEFORE the catch-all.
    for (const mount of this.extensionRouteMounts) {
      try {
        mount(this.app);
      } catch (err) {
        this.logger.warn("Extension route mount failed", { error: String(err) });
      }
    }

    // Serve built dashboard AFTER plugin routes (catch-all must be last)
    const distPath = resolve(import.meta.dirname ?? __dirname, "../dashboard/dist");
    if (existsSync(distPath)) {
      this.app.use(express.static(distPath));
      this.app.get("*", (_req, res) => {
        res.sendFile(join(distPath, "index.html"));
      });
    }

    try {
      await this.listen();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        this.logger.warn("Port in use, killing stale process", { port: this.port });
        if (this.killStaleProcess()) {
          // Wait briefly for the port to free up, then retry once
          await new Promise((r) => setTimeout(r, 1000));
          try {
            await this.listen();
            return;
          } catch {
            // Fall through to degraded mode
          }
        }
        this.logger.warn("Dashboard unavailable — port still in use, continuing without it", { port: this.port });
        return; // Don't crash the MCP server
      }
      throw err;
    }
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.once("error", reject);
      this.httpServer.listen(this.port, () => {
        this.httpServer.removeListener("error", reject);
        this.logger.info("Dashboard server started", { port: this.port });
        resolve();
      });
    });
  }

  private killStaleProcess(): boolean {
    try {
      const pid = execSync(`lsof -ti:${this.port}`, { encoding: "utf8" }).trim();
      if (pid) {
        this.logger.info("Killing stale dashboard process", { pid });
        execSync(`kill ${pid}`);
        return true;
      }
    } catch {
      // lsof returns non-zero if no process found — that's fine
    }
    return false;
  }

  async stop(): Promise<void> {
    this.spacesManager.stop();
    this.pluginLoader.shutdown();
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      this.httpServer.close(() => {
        this.logger.info("Dashboard server stopped");
        resolve();
      });
    });
  }

  // Expose SpacesManager for MCP tools
  getSpacesManager(): SpacesManager {
    return this.spacesManager;
  }

  // R222: Track last /api/wait call for Claude liveness detection
  getLastWaitPoll(): number {
    return this.lastWaitPoll;
  }

  getCompactionStats() {
    return this.compactionManager.getCompactionStats();
  }

  // Broadcast event to all connected dashboard clients
  broadcastEvent(event: Event): void {
    this.broadcast({
      type: "event",
      payload: {
        id: event.id,
        type: event.type,
        source: event.source,
        timestamp: event.timestamp,
        payload: event.payload,
      },
    });
  }

  private setupRoutes(): void {
    // API endpoints
    this.app.get("/api/status", (_req, res) => {
      const status = this.loop.getStatus();
      const compaction = this.compactionManager.getCompactionStats();
      res.json({ ...status, compaction: { count: compaction.count, loopFailures: compaction.loopFailures, pending: !!compaction.pending } });
    });

    this.app.get("/api/compaction-stats", (_req, res) => {
      res.json(this.compactionManager.getCompactionStats());
    });

    this.app.post("/api/compaction/reset", (_req, res) => {
      this.compactionManager.resetCount();
      res.json({ ok: true, message: "Compaction counter reset to 0" });
    });

    // R408: Return dashboard.skills config map for frontend filtering
    this.app.get("/api/config/skills", (_req, res) => {
      const config = this.loop.getConfig().getAll();
      const skills = (config as any).dashboard?.skills ?? {};
      res.json(skills);
    });

    this.app.get("/api/events", (req, res) => {
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(this.loop.getEventHistory().slice(-limit));
    });

    // Accept external events (e.g. phone call transcripts)
    this.app.post("/api/events", express.json(), (req, res) => {
      const { type, source, payload, priority } = req.body;
      if (!type || !source || !payload) {
        res.status(400).json({ error: "Missing required fields: type, source, payload" });
        return;
      }
      const event: Event = {
        id: randomUUID(),
        type,
        source,
        timestamp: Date.now(),
        payload,
        priority,
      };
      this.loop.emit(event);
      this.logger.info(`External event injected: ${type} from ${source}`);
      res.json({ ok: true, id: event.id });
    });

    this.app.get("/api/timers", (_req, res) => {
      res.json(this.loop.getTimerService().getAll());
    });

    this.app.get("/api/memory/stats", (_req, res) => {
      res.json(this.loop.getMemoryIndex().getStats());
    });

    // ACC Conflict Monitor health endpoint — exposes conflict_log aggregates +
    // the 10 most recent conflicts for dashboard observability.
    this.app.get("/api/conflict-health", (_req, res) => {
      const monitor = this.loop.getConflictMonitor();
      const stats = monitor.getConflictStats();
      const recentConflicts = monitor.getRecentConflicts(10);
      res.json({ ...stats, recentConflicts });
    });

    // Memory utilization — how much of what we've indexed is actually being
    // retrieved. Feeds the dashboard's "never retrieved" + top-K panels.
    this.app.get("/api/memory-health", (_req, res) => {
      try {
        const memIndex = this.loop.getMemoryIndex();
        const mostRetrieved = memIndex.getMostRetrieved(10);
        const neverRetrieved = memIndex.getNeverRetrieved(90);
        const stats = memIndex.getStats();
        const totalFiles = stats.fileCount;
        const utilizationRate = totalFiles > 0 ? 1 - neverRetrieved.length / totalFiles : 0;
        res.json({
          totalFiles,
          retrievedFiles: totalFiles - neverRetrieved.length,
          neverRetrievedCount: neverRetrieved.length,
          utilizationRate,
          topRetrieved: mostRetrieved,
          neverRetrievedSample: neverRetrieved.slice(0, 20),
        });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // V32, V33: Unified search endpoint — merges vault + memory results
    this.app.get("/api/search/unified", async (req, res) => {
      const q = req.query.q as string;
      if (!q) {
        res.status(400).json({ error: "Missing required query parameter: q" });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 10;
      const unifiedSearch = this.loop.getUnifiedSearch();
      if (!unifiedSearch) {
        // Fall back to memory-only search if vault not configured
        const results = await this.loop.getMemoryIndex().search(q, { limit });
        res.json(results.map((r) => ({ ...r, source: "memory" })));
        return;
      }
      try {
        const results = await unifiedSearch.search(q, { limit });
        res.json(results);
      } catch (err) {
        res.status(500).json({ error: `Search failed: ${String(err)}` });
      }
    });

    // Vault stats endpoint
    this.app.get("/api/vault/stats", (_req, res) => {
      const vaultIndex = this.loop.getVaultIndex();
      if (!vaultIndex) {
        res.json({ enabled: false });
        return;
      }
      res.json({ enabled: true, ...vaultIndex.getStats() });
    });

    this.app.get("/api/identity/soul", (_req, res) => {
      res.type("text/markdown").send(this.loop.getIdentityManager().getSoul() || "(not configured)");
    });

    this.app.get("/api/identity/user", (_req, res) => {
      res.type("text/markdown").send(this.loop.getIdentityManager().getUser() || "(not configured)");
    });

    this.app.get("/api/identity/state", (_req, res) => {
      res.type("text/markdown").send(this.loop.getIdentityManager().getAgentState() || "(no state file)");
    });

    // R151, R152: Long-poll endpoint — digest on normal wakes, full identity after compaction
    // Maintains a server-side delivery watermark to prevent replaying old events after compaction
    // Optional `since` query param (ms timestamp) overrides the watermark
    this.app.get("/api/wait", async (req, res) => {
      // R222: Track last poll time for Claude liveness detection
      this.lastWaitPoll = Date.now();
      // Mark event loop as active on first call — persists for backend lifetime
      this.compactionManager.setEventLoopActive();
      const timeout = Math.min(parseInt(req.query.timeout as string) || 30, 120) * 1000;
      const sinceParam = req.query.since ? parseInt(req.query.since as string) : undefined;
      try {
        const events = await this.loop.waitForEvent(timeout, sinceParam);
        if (events.length === 0) {
          res.status(204).end();
        } else {
          const identity = this.loop.getIdentityManager();
          const needsFull = this.compactionManager.consumeCompactionFlag();
          const identityPayload = needsFull
            ? { soul: identity.getSoul(), user: identity.getUser(), state: identity.getAgentState(), full: true }
            : { digest: identity.getDigest(), full: false };
          const compactionStats = this.compactionManager.getCompactionStats();
          const shouldRestart = this.compactionManager.shouldAutoRestart();
          res.json({
            identity: identityPayload,
            events,
            cursor: this.loop.getDeliveryWatermark(),
            compaction: { count: compactionStats.count, loopFailures: compactionStats.loopFailures },
            ...(shouldRestart && { shouldRestart: true }),
            // Echo current wall time in Max's TZ so wake-ups can sanity-check
            // their date without another tool call. Mitigates the long-running
            // session date-drift problem that caused BUG-20260418-4-style
            // harms (wrong "tomorrow" in outbound mail).
            currentTime: new Date().toLocaleString("en-US", {
              timeZone: "America/Chicago",
              weekday: "short", month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit", hour12: true,
            }),
          });
        }
      } catch {
        res.status(204).end();
      }
    });

    // --- Proxy API routes (used by mcp-proxy.ts) ---
    this.app.get("/api/health", (_req, res) => {
      res.json({ ok: true, state: "running", pid: process.pid });
    });

    // Phone channel: check if Claude Code has an active event loop consumer
    this.app.get("/api/consumer-status", (_req, res) => {
      res.json({ active: this.loop.hasActiveConsumer() });
    });

    // --- Compaction hooks (called by Claude Code PreCompact/SessionStart hooks) ---
    this.app.get("/api/pre-compact", (_req, res) => {
      const prompt = this.compactionManager.handlePreCompact();
      res.type("text/plain").send(prompt);
    });

    this.app.get("/api/post-compact", (_req, res) => {
      const context = this.compactionManager.handlePostCompact();
      res.type("text/plain").send(context);
    });

    // --- Session Checkpoint endpoints (R126, R127, R130) ---
    this.app.post("/api/checkpoint", express.json(), (req, res) => {
      this.loop.getSessionCheckpoint().update(req.body);
      res.json({ ok: true });
    });

    this.app.get("/api/checkpoint", (_req, res) => {
      const data = this.loop.getSessionCheckpoint().getData() ?? this.loop.getSessionCheckpoint().load();
      res.json(data ?? {});
    });

    this.app.delete("/api/checkpoint", (_req, res) => {
      this.loop.getSessionCheckpoint().clear();
      res.json({ ok: true });
    });

    this.app.post("/api/compaction-reset", (_req, res) => {
      this.compactionManager.resetCount();
      res.json({ ok: true });
    });

    // --- Agent Registry endpoints (R137, R138, R139) ---
    this.app.post("/api/agents", express.json(), (req, res) => {
      const { id, description } = req.body as { id: string; description: string };
      const ok = this.loop.getAgentRegistry().register(id, description);
      if (ok) {
        res.json({ ok: true });
      } else {
        res.status(429).json({ error: "Agent registry at capacity" });
      }
    });

    this.app.get("/api/agents", (_req, res) => {
      res.json(this.loop.getAgentRegistry().getAll());
    });

    this.app.patch("/api/agents/:id", express.json(), (req, res) => {
      const { id } = req.params;
      const { status, result, error } = req.body as { status: string; result?: string; error?: string };
      const registry = this.loop.getAgentRegistry();
      if (status === "completed" && result) {
        registry.complete(id, result);
      } else if (status === "failed" && error) {
        registry.fail(id, error);
      }
      res.json({ ok: true });
    });

    this.app.delete("/api/agents/:id", (req, res) => {
      this.loop.getAgentRegistry().cleanup(req.params.id);
      res.json({ ok: true });
    });

    // Agent completion callback — agents POST here when done
    this.app.post("/api/agents/:id/complete", express.json(), (req, res) => {
      const { id } = req.params;
      const { result, error } = req.body as { result?: string; error?: string };
      const registry = this.loop.getAgentRegistry();
      if (error) {
        registry.fail(id, error);
      } else {
        registry.complete(id, result ?? "(completed)");
      }
      res.json({ ok: true });
    });

    // R221: Restart result callback — restart script POSTs here when done
    this.app.post("/api/restart-result", express.json(), (req, res) => {
      const { success, message } = req.body as { success: boolean; message?: string };
      const chatId = this.restartChatId;
      if (chatId) {
        const text = success
          ? `Claude Code restarted.${message ? ` ${message}` : ""}`
          : `Restart failed: ${message ?? "unknown error"}`;
        // Send via Telegram adapter
        const telegram = this.loop.getChannelManager().getAdapter("telegram");
        if (telegram) {
          telegram.send(chatId, { text }).catch((err) => {
            this.logger.warn("Failed to send restart result", { error: String(err) });
          });
        }
        this.restartChatId = null;
      }
      res.json({ ok: true });
    });

    // R222: Store the chat ID for restart result callback
    this.app.post("/api/restart-chat", express.json(), (req, res) => {
      this.restartChatId = req.body.chatId;
      res.json({ ok: true });
    });

    this.app.get("/api/tool-list", (_req, res) => {
      res.json(this.mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })));
    });

    this.app.post("/api/tool-call", express.json(), async (req, res) => {
      const { name, args } = req.body as { name: string; args: Record<string, unknown> };
      const tool = this.mcpTools.find((t) => t.name === name);
      if (!tool) {
        res.status(404).json({ content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
        return;
      }
      try {
        const result = await tool.handler(args ?? {});
        res.json(result);
      } catch (err) {
        res.status(500).json({ content: [{ type: "text", text: `Tool error: ${String(err)}` }], isError: true });
      }
    });

    this.app.get("/api/resource-list", (_req, res) => {
      res.json(this.mcpResources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })));
    });

    this.app.post("/api/resource", express.json(), async (req, res) => {
      const { uri } = req.body as { uri: string };
      const resource = this.mcpResources.find((r) => r.uri === uri);
      if (!resource) {
        res.status(404).json({ error: `Unknown resource: ${uri}` });
        return;
      }
      try {
        const text = await resource.handler();
        res.json({ uri: resource.uri, mimeType: resource.mimeType, text });
      } catch (err) {
        res.status(500).json({ error: `Resource error: ${String(err)}` });
      }
    });

    // --- Apps Platform endpoints (CRC: crc-AppRegistry.md, crc-AppDataStore.md) ---
    const appsDir = this.appRegistry.getAppsDir();

    // R198, R207: List all registered apps
    this.app.get("/api/apps", (_req, res) => {
      // Re-scan to pick up new apps since startup
      this.appRegistry.scan();
      res.json(this.appRegistry.getAll());
    });

    // R191: Read app data
    this.app.get("/api/apps/:slug/data", (req, res) => {
      res.json(this.appDataStore.read(req.params.slug));
    });

    // R192: Write app data
    this.app.put("/api/apps/:slug/data", express.json(), (req, res) => {
      this.appDataStore.write(req.params.slug, req.body);
      res.json({ ok: true });
    });

    // R190, R209: Invoke app hook (read/write/describe) — used by app_invoke MCP tool
    this.app.post("/api/apps/:slug/invoke", express.json(), (req, res) => {
      const { hook, data } = req.body as { hook: string; data?: Record<string, unknown> };
      const result = this.appDataStore.invoke(req.params.slug, hook, data);
      res.json(result);
    });

    // Serve static files from app directories (icons, index.html, etc.)
    this.app.get("/api/apps/:slug/static/:file", (req, res) => {
      const filePath = join(appsDir, req.params.slug, req.params.file);
      if (!existsSync(filePath)) { res.status(404).end(); return; }
      res.sendFile(filePath);
    });

    // --- Kanban task CRUD ---
    const kanbanDataPath = join(appsDir, "kanban", "data.json");

    const readKanban = (): { tasks: Array<Record<string, unknown>> } => {
      if (!existsSync(kanbanDataPath)) return { tasks: [] };
      try { return JSON.parse(readFileSync(kanbanDataPath, "utf8")); }
      catch { return { tasks: [] }; }
    };

    const writeKanban = (data: { tasks: Array<Record<string, unknown>> }): void => {
      const dir = join(appsDir, "kanban");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(kanbanDataPath, JSON.stringify(data, null, 2));
    };

    // Auto-flush done tasks older than 3 days
    const flushDoneTasks = () => {
      const data = readKanban();
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const before = data.tasks.length;
      data.tasks = data.tasks.filter(
        (t) => t.status !== "done" || new Date(t.updated as string).getTime() > cutoff
      );
      if (data.tasks.length < before) writeKanban(data);
      return data;
    };

    // List all tasks (auto-flushes stale done tasks)
    this.app.get("/api/kanban/tasks", (_req, res) => {
      res.json(flushDoneTasks().tasks);
    });

    // Create a task
    this.app.post("/api/kanban/tasks", express.json(), (req, res) => {
      const data = readKanban();
      const task = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: req.body.title ?? "Untitled",
        description: req.body.description ?? "",
        assignee: req.body.assignee ?? "max",
        status: req.body.status ?? "todo",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      data.tasks.push(task);
      writeKanban(data);
      res.json(task);
    });

    // Update a task
    this.app.patch("/api/kanban/tasks/:id", express.json(), (req, res) => {
      const data = readKanban();
      const task = data.tasks.find((t) => t.id === req.params.id);
      if (!task) { res.status(404).json({ error: "Task not found" }); return; }
      const { title, description, assignee, status } = req.body;
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (assignee !== undefined) task.assignee = assignee;
      if (status !== undefined) task.status = status;
      task.updated = new Date().toISOString();
      writeKanban(data);
      res.json(task);
    });

    // Delete a task
    this.app.delete("/api/kanban/tasks/:id", (req, res) => {
      const data = readKanban();
      data.tasks = data.tasks.filter((t) => t.id !== req.params.id);
      writeKanban(data);
      res.json({ ok: true });
    });

    // --- Journal CRUD (JSON files) ---
    const journalDir = join(homedir(), ".homaruscc", "apps", "journal", "entries");

    const ensureJournalDir = () => {
      if (!existsSync(journalDir)) mkdirSync(journalDir, { recursive: true });
    };

    const readJournalEntry = (id: string): Record<string, unknown> | null => {
      const filePath = join(journalDir, `${id}.json`);
      if (!existsSync(filePath)) return null;
      try { return JSON.parse(readFileSync(filePath, "utf8")); }
      catch { return null; }
    };

    const writeJournalEntry = (entry: Record<string, unknown>): void => {
      ensureJournalDir();
      writeFileSync(join(journalDir, `${entry.id}.json`), JSON.stringify(entry, null, 2));
    };

    const readAllJournalEntries = (): Record<string, unknown>[] => {
      ensureJournalDir();
      const entries: Record<string, unknown>[] = [];
      for (const file of readdirSync(journalDir)) {
        if (!file.endsWith(".json")) continue;
        try { entries.push(JSON.parse(readFileSync(join(journalDir, file), "utf8"))); }
        catch { /* skip corrupt files */ }
      }
      return entries.sort((a, b) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
      );
    };

    // AI analysis using Claude Haiku
    const analyzeJournalEntry = async (content: string, entryId: string): Promise<void> => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return;
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `Analyze this journal entry. Return ONLY valid JSON with these fields:
- sentiment: "positive" | "neutral" | "negative"
- sentimentScore: number 0-1 (0=very negative, 1=very positive)
- emotions: object with keys from [joy, motivated, anxious, grateful, sad, angry, peaceful], values 0-100, only include emotions above 5
- suggestedTags: string[] (2-5 suggested tags based on content)
- category: one of: personal, idea, reflection, work, creative, health, relationship

Journal entry:
${content.slice(0, 2000)}`,
          }],
        });
        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        // Extract JSON from response (handle possible markdown fences)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return;
        const analysis = JSON.parse(jsonMatch[0]);

        // Read entry, merge analysis, write back
        const entry = readJournalEntry(entryId);
        if (!entry) return;
        if (analysis.sentiment) entry.sentiment = analysis.sentiment;
        if (typeof analysis.sentimentScore === "number") entry.sentimentScore = analysis.sentimentScore;
        if (analysis.emotions && typeof analysis.emotions === "object") entry.emotions = analysis.emotions;
        if (Array.isArray(analysis.suggestedTags) && (entry.tags as string[]).length === 0) {
          entry.tags = analysis.suggestedTags;
        }
        if (analysis.category && entry.category === "personal") entry.category = analysis.category;
        entry.updatedAt = new Date().toISOString();
        writeJournalEntry(entry);
      } catch (err) {
        this.logger.warn("Journal AI analysis failed", { error: String(err) });
      }
    };

    // List all entries (sorted by createdAt desc)
    this.app.get("/api/journal/entries", (_req, res) => {
      res.json(readAllJournalEntries());
    });

    // Get single entry
    this.app.get("/api/journal/entries/:id", (req, res) => {
      const entry = readJournalEntry(req.params.id);
      if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
      res.json(entry);
    });

    // Create entry
    this.app.post("/api/journal/entries", express.json(), (req, res) => {
      ensureJournalDir();
      const now = new Date().toISOString();
      const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: Record<string, unknown> = {
        id,
        title: req.body.title ?? "",
        content: req.body.content ?? "",
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        category: req.body.category ?? "personal",
        private: req.body.private ?? false,
        sentiment: "neutral",
        sentimentScore: 0.5,
        emotions: {},
        createdAt: now,
        updatedAt: now,
      };
      writeJournalEntry(entry);
      res.json(entry);

      // Run AI analysis in background (non-blocking)
      const content = entry.content as string;
      if (content.trim()) {
        analyzeJournalEntry(content, id).catch(() => {});
      }

      // Index non-private entries in memory system
      if (!entry.private && content.trim()) {
        const titleSlug = (entry.title as string || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
        const dateSlug = now.slice(0, 10);
        const memoryKey = `local/journal/${dateSlug}-${titleSlug}.md`;
        const memoryTool = this.mcpTools.find((t) => t.name === "memory_store");
        if (memoryTool) {
          memoryTool.handler({ key: memoryKey, content: `# ${entry.title || "Journal Entry"}\n\n${content}` }).catch(() => {});
        }
      }
    });

    // Update entry
    this.app.patch("/api/journal/entries/:id", express.json(), (req, res) => {
      const entry = readJournalEntry(req.params.id);
      if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
      const { title, content, tags, category, private: priv } = req.body;
      if (title !== undefined) entry.title = title;
      if (content !== undefined) entry.content = content;
      if (tags !== undefined) entry.tags = tags;
      if (category !== undefined) entry.category = category;
      if (priv !== undefined) entry.private = priv;
      entry.updatedAt = new Date().toISOString();
      writeJournalEntry(entry);
      res.json(entry);

      // Re-analyze if content changed
      if (content !== undefined && (content as string).trim()) {
        analyzeJournalEntry(content as string, req.params.id).catch(() => {});
      }
    });

    // Delete entry
    this.app.delete("/api/journal/entries/:id", (req, res) => {
      const filePath = join(journalDir, `${req.params.id}.json`);
      if (existsSync(filePath)) unlinkSync(filePath);
      res.json({ ok: true });
    });

    // Stats endpoint
    this.app.get("/api/journal/stats", (_req, res) => {
      const entries = readAllJournalEntries();
      if (entries.length === 0) {
        res.json({ totalEntries: 0, currentStreak: 0, longestStreak: 0, averageMood: 0.5, recentEmotions: {}, entriesByCategory: {} });
        return;
      }

      // Streak calculation
      const entryDates = Array.from(new Set(
        entries.map((e) => new Date(e.createdAt as string).toISOString().slice(0, 10))
      )).sort().reverse();

      let currentStreak = 0;
      let longestStreak = 0;
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < entryDates.length; i++) {
        const d = new Date(entryDates[i]);
        d.setHours(0, 0, 0, 0);
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);

        if (d.getTime() === expected.getTime()) {
          streak++;
        } else {
          if (i === 0) {
            // Check if yesterday matches (streak still valid if no entry today yet)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (d.getTime() === yesterday.getTime()) {
              streak = 1;
              continue;
            }
          }
          break;
        }
      }
      currentStreak = streak;

      // Longest streak (simple scan)
      let tempStreak = 1;
      longestStreak = 1;
      for (let i = 1; i < entryDates.length; i++) {
        const prev = new Date(entryDates[i - 1]);
        const curr = new Date(entryDates[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak);

      // Average mood
      const scores = entries.map((e) => (e.sentimentScore as number) ?? 0.5);
      const averageMood = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Recent emotions (last 7 days)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentEntries = entries.filter((e) => new Date(e.createdAt as string).getTime() > weekAgo);
      const emotionSums: Record<string, number[]> = {};
      for (const e of recentEntries) {
        const emotions = (e.emotions ?? {}) as Record<string, number>;
        for (const [k, v] of Object.entries(emotions)) {
          if (!emotionSums[k]) emotionSums[k] = [];
          emotionSums[k].push(v);
        }
      }
      const recentEmotions: Record<string, number> = {};
      for (const [k, vals] of Object.entries(emotionSums)) {
        recentEmotions[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }

      // Entries by category
      const entriesByCategory: Record<string, number> = {};
      for (const e of entries) {
        const cat = e.category as string ?? "personal";
        entriesByCategory[cat] = (entriesByCategory[cat] ?? 0) + 1;
      }

      res.json({ totalEntries: entries.length, currentStreak, longestStreak, averageMood, recentEmotions, entriesByCategory });
    });

    // --- Agent Chat endpoints (Caul ↔ Hal collaboration) ---
    const agentChatPath = join(homedir(), ".homaruscc", "agent-chat.json");

    const readAgentChat = (): AgentChatMessage[] => {
      if (!existsSync(agentChatPath)) return [];
      try { return JSON.parse(readFileSync(agentChatPath, "utf8")); }
      catch { return []; }
    };

    const writeAgentChat = (messages: AgentChatMessage[]): void => {
      writeFileSync(agentChatPath, JSON.stringify(messages, null, 2));
    };

    // GET /api/agent-chat — fetch message history
    this.app.get("/api/agent-chat", (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const since = req.query.since ? parseInt(req.query.since as string) : 0;
      let messages = readAgentChat();
      if (since) messages = messages.filter(m => m.timestamp > since);
      res.json(messages.slice(-limit));
    });

    // POST /api/agent-chat — send a message (used by both Caul and Hal)
    this.app.post("/api/agent-chat", express.json(), (req, res) => {
      const { from, text, replyTo } = req.body as { from: string; text: string; replyTo?: string };
      if (!from || !text) {
        res.status(400).json({ error: "Missing required fields: from, text" });
        return;
      }
      const message: AgentChatMessage = {
        id: randomUUID(),
        from,
        text,
        timestamp: Date.now(),
        ...(replyTo && { replyTo }),
      };
      const messages = readAgentChat();
      messages.push(message);
      // Keep last 500 messages
      const trimmed = messages.slice(-500);
      writeAgentChat(trimmed);

      // Broadcast to dashboard WebSocket clients
      this.broadcast({ type: "agent-chat", payload: message });

      // Emit as event so Claude Code picks it up via /api/wait
      this.loop.emit({
        id: randomUUID(),
        type: "agent_message",
        source: `agent:${from}`,
        timestamp: message.timestamp,
        payload: message,
      });

      this.logger.info(`Agent chat: ${from} sent message`, { messageId: message.id });
      res.json(message);

      // Ping Hal's webhook on EC2 if the message isn't from Hal
      if (from !== "hal") {
        const webhookUrl = "http://100.73.65.3:3121/webhook/agent-chat";
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, text }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {
          // Webhook unreachable — Hal will pick it up on next heartbeat
          this.logger.warn("Agent chat webhook unreachable (EC2 may be offline)");
        });
      }
    });

    // DELETE /api/agent-chat — clear history
    this.app.delete("/api/agent-chat", (_req, res) => {
      writeAgentChat([]);
      res.json({ ok: true });
    });

    // --- CRM CRUD (markdown files with YAML frontmatter) ---
    const crmDir = resolve(import.meta.dirname ?? __dirname, "..", "local", "crm");

    interface CrmContact {
      slug: string;
      name: string;
      aliases: string[];
      email?: string;
      phone?: string;
      social?: Record<string, string>;
      tags: string[];
      connections: Array<{ name: string; relationship: string }>;
      context: string;
      source: string;
      lastMentioned: string;
      created: string;
      notes: string;
    }

    const parseCrmFile = (slug: string, content: string): CrmContact => {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!fmMatch) return { slug, name: slug, aliases: [], tags: [], connections: [], context: "", source: "manual", lastMentioned: new Date().toISOString().slice(0, 10), created: new Date().toISOString().slice(0, 10), notes: content };
      const fm: Record<string, unknown> = {};
      for (const line of fmMatch[1].split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();
        if (val.startsWith("[") && val.endsWith("]")) {
          try { fm[key] = JSON.parse(val); } catch { fm[key] = val; }
        } else {
          fm[key] = val;
        }
      }
      // Parse connections from YAML array format
      const connections: Array<{ name: string; relationship: string }> = [];
      if (Array.isArray(fm.connections)) {
        for (const c of fm.connections) {
          if (typeof c === "object" && c !== null) connections.push(c as { name: string; relationship: string });
        }
      }
      return {
        slug,
        name: (fm.name as string) ?? slug,
        aliases: Array.isArray(fm.aliases) ? fm.aliases as string[] : [],
        email: fm.email as string | undefined,
        phone: fm.phone as string | undefined,
        social: fm.social as Record<string, string> | undefined,
        tags: Array.isArray(fm.tags) ? fm.tags as string[] : [],
        connections,
        context: (fm.context as string) ?? "",
        source: (fm.source as string) ?? "manual",
        lastMentioned: (fm.lastMentioned as string) ?? new Date().toISOString().slice(0, 10),
        created: (fm.created as string) ?? new Date().toISOString().slice(0, 10),
        notes: fmMatch[2].trim(),
      };
    };

    const contactToMarkdown = (c: Omit<CrmContact, "slug">): string => {
      const lines = [
        "---",
        `name: ${c.name}`,
        `aliases: ${JSON.stringify(c.aliases ?? [])}`,
      ];
      if (c.email) lines.push(`email: ${c.email}`);
      if (c.phone) lines.push(`phone: ${c.phone}`);
      if (c.social) lines.push(`social: ${JSON.stringify(c.social)}`);
      lines.push(`tags: ${JSON.stringify(c.tags ?? [])}`);
      if (c.connections?.length) {
        lines.push(`connections: ${JSON.stringify(c.connections)}`);
      } else {
        lines.push("connections: []");
      }
      lines.push(`context: ${c.context ?? ""}`);
      lines.push(`source: ${c.source ?? "manual"}`);
      lines.push(`lastMentioned: ${c.lastMentioned ?? new Date().toISOString().slice(0, 10)}`);
      lines.push(`created: ${c.created ?? new Date().toISOString().slice(0, 10)}`);
      lines.push("---");
      if (c.notes) lines.push("", c.notes);
      return lines.join("\n") + "\n";
    };

    const slugify = (name: string): string =>
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // List all contacts
    this.app.get("/api/crm/contacts", (_req, res) => {
      if (!existsSync(crmDir)) { res.json([]); return; }
      const contacts: CrmContact[] = [];
      for (const file of readdirSync(crmDir)) {
        if (!file.endsWith(".md")) continue;
        try {
          const content = readFileSync(join(crmDir, file), "utf8");
          contacts.push(parseCrmFile(file.replace(/\.md$/, ""), content));
        } catch { /* skip */ }
      }
      contacts.sort((a, b) => b.lastMentioned.localeCompare(a.lastMentioned));
      res.json(contacts);
    });

    // Get single contact
    this.app.get("/api/crm/contacts/:slug", (req, res) => {
      const filePath = join(crmDir, `${req.params.slug}.md`);
      if (!existsSync(filePath)) { res.status(404).json({ error: "Contact not found" }); return; }
      const content = readFileSync(filePath, "utf8");
      res.json(parseCrmFile(req.params.slug, content));
    });

    // Create contact
    this.app.post("/api/crm/contacts", express.json(), (req, res) => {
      if (!existsSync(crmDir)) mkdirSync(crmDir, { recursive: true });
      const body = req.body as Partial<CrmContact>;
      if (!body.name) { res.status(400).json({ error: "Name required" }); return; }
      const slug = slugify(body.name);
      const filePath = join(crmDir, `${slug}.md`);
      const contact: CrmContact = {
        slug,
        name: body.name,
        aliases: body.aliases ?? [],
        email: body.email,
        phone: body.phone,
        social: body.social,
        tags: body.tags ?? [],
        connections: body.connections ?? [],
        context: body.context ?? "",
        source: body.source ?? "manual",
        lastMentioned: new Date().toISOString().slice(0, 10),
        created: new Date().toISOString().slice(0, 10),
        notes: body.notes ?? "",
      };
      writeFileSync(filePath, contactToMarkdown(contact));
      res.json(contact);
    });

    // Update contact
    this.app.patch("/api/crm/contacts/:slug", express.json(), (req, res) => {
      const filePath = join(crmDir, `${req.params.slug}.md`);
      if (!existsSync(filePath)) { res.status(404).json({ error: "Contact not found" }); return; }
      const existing = parseCrmFile(req.params.slug, readFileSync(filePath, "utf8"));
      const body = req.body as Partial<CrmContact>;
      const updated = { ...existing, ...body, slug: existing.slug };
      writeFileSync(filePath, contactToMarkdown(updated));
      // If name changed, rename the file
      if (body.name && slugify(body.name) !== existing.slug) {
        const newSlug = slugify(body.name);
        const newPath = join(crmDir, `${newSlug}.md`);
        renameSync(filePath, newPath);
        updated.slug = newSlug;
      }
      res.json(updated);
    });

    // Delete contact
    this.app.delete("/api/crm/contacts/:slug", (req, res) => {
      const filePath = join(crmDir, `${req.params.slug}.md`);
      if (existsSync(filePath)) unlinkSync(filePath);
      res.json({ ok: true });
    });

    // --- Spaces CRUD (R310-R318) ---
    // CRC: crc-SpacesManager.md | Seq: seq-spaces-crud.md

    this.app.get("/api/spaces/tree", (_req, res) => {
      res.json(this.spacesManager.getTree());
    });

    this.app.post("/api/spaces/buckets", express.json(), (req, res) => {
      try {
        const meta = this.spacesManager.createBucket(req.body);
        res.json(meta);
      } catch (err) {
        res.status(400).json({ error: String(err) });
      }
    });

    this.app.patch("/api/spaces/buckets/:id", express.json(), (req, res) => {
      try {
        const meta = this.spacesManager.updateBucket(req.params.id, req.body);
        res.json(meta);
      } catch (err) {
        res.status(404).json({ error: String(err) });
      }
    });

    this.app.delete("/api/spaces/buckets/:id", (req, res) => {
      try {
        this.spacesManager.deleteBucket(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(404).json({ error: String(err) });
      }
    });

    this.app.post("/api/spaces/buckets/:id/items", express.json(), (req, res) => {
      try {
        const item = this.spacesManager.createItem(req.params.id, req.body);
        res.json(item);
      } catch (err) {
        res.status(400).json({ error: String(err) });
      }
    });

    this.app.patch("/api/spaces/items/:id", express.json(), (req, res) => {
      try {
        const item = this.spacesManager.updateItem(req.params.id, req.body);
        res.json(item);
      } catch (err) {
        res.status(404).json({ error: String(err) });
      }
    });

    this.app.delete("/api/spaces/items/:id", (req, res) => {
      try {
        this.spacesManager.deleteItem(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(404).json({ error: String(err) });
      }
    });

    this.app.post("/api/spaces/items/:id/move", express.json(), (req, res) => {
      try {
        const item = this.spacesManager.moveItem(req.params.id, req.body.targetBucketId);
        res.json(item);
      } catch (err) {
        res.status(400).json({ error: String(err) });
      }
    });

    this.app.post("/api/spaces/items/:id/reorder", express.json(), (req, res) => {
      try {
        const direction = req.body.direction as "up" | "down";
        if (direction !== "up" && direction !== "down") {
          res.status(400).json({ error: "direction must be 'up' or 'down'" });
          return;
        }
        this.spacesManager.reorderItem(req.params.id, direction);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: String(err) });
      }
    });

    this.app.get("/api/spaces/search", (req, res) => {
      const q = req.query.q as string;
      if (!q) { res.json([]); return; }
      res.json(this.spacesManager.search(q));
    });

    // Record collection and other plugin routes are mounted by pluginLoader in start()

    // --- Document viewer endpoint ---
    // Serves markdown files from allowed base directories
    const projectDir = resolve(import.meta.dirname ?? __dirname, "..");
    const halShareDir = resolve(projectDir, "../HalShare");
    const homarusccDir = join(homedir(), ".homaruscc");
    const allowedBases: Record<string, string> = {
      "HalShare": halShareDir,
      "~/.homaruscc": homarusccDir,
      "crm": resolve(projectDir, "local", "crm"),
    };

    this.app.get("/api/docs", (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath) { res.status(400).json({ error: "path required" }); return; }

      // Resolve against allowed bases
      let resolved: string | null = null;
      for (const [prefix, base] of Object.entries(allowedBases)) {
        if (filePath.startsWith(prefix + "/") || filePath.startsWith(prefix + "\\")) {
          const relative = filePath.slice(prefix.length + 1);
          const full = resolve(base, relative);
          // Prevent directory traversal
          if (full.startsWith(base)) { resolved = full; break; }
        }
      }

      if (!resolved || !existsSync(resolved)) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      res.type("text/markdown").send(readFileSync(resolved, "utf8"));
    });

    // Note: static file serving + catch-all route is set up in start() after plugin routes
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      this.logger.info("Dashboard client connected", { clients: this.clients.size });

      // Send initial status
      this.sendTo(ws, { type: "status", payload: this.loop.getStatus() });

      // Send recent events
      const recentEvents = this.loop.getEventHistory().slice(-20);
      for (const event of recentEvents) {
        this.sendTo(ws, {
          type: "event",
          payload: {
            id: event.id,
            type: event.type,
            source: event.source,
            timestamp: event.timestamp,
            payload: event.payload,
          },
        });
      }

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          this.handleWsMessage(ws, msg);
        } catch (err) {
          this.sendTo(ws, { type: "error", payload: { message: "Invalid message format" } });
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        this.logger.info("Dashboard client disconnected", { clients: this.clients.size });
      });

      ws.on("error", (err) => {
        this.logger.warn("WebSocket error", { error: String(err) });
        this.clients.delete(ws);
      });
    });
  }

  private handleWsMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case "chat": {
        const { text } = msg.payload as { text: string };
        if (!text) return;
        // Echo user message to all dashboard clients so both sides of the conversation are visible
        this.broadcast({
          type: "chat",
          payload: { from: "user", text, timestamp: Date.now() },
        });
        // Deliver chat message through the dashboard adapter → event loop → MCP
        this.dashboardAdapter.receiveFromDashboard("dashboard-user", text);
        break;
      }
      case "search": {
        const { query, limit } = msg.payload as { query: string; limit?: number };
        if (!query) return;
        this.loop.getMemoryIndex().search(query, { limit }).then((results) => {
          this.sendTo(ws, { type: "search_results", payload: results });
        }).catch((err) => {
          this.sendTo(ws, { type: "error", payload: { message: String(err) } });
        });
        break;
      }
      case "status": {
        this.sendTo(ws, { type: "status", payload: this.loop.getStatus() });
        break;
      }
      case "events": {
        const { limit = 50 } = msg.payload as { limit?: number };
        this.sendTo(ws, {
          type: "event",
          payload: this.loop.getEventHistory().slice(-limit),
        });
        break;
      }
      case "agent-chat": {
        // Dashboard user watching can also inject messages (as "max" observer)
        const { from, text } = msg.payload as { from: string; text: string };
        if (!from || !text) return;
        // Post through the REST endpoint logic
        const agentChatPath = join(homedir(), ".homaruscc", "agent-chat.json");
        const message: AgentChatMessage = {
          id: randomUUID(),
          from,
          text,
          timestamp: Date.now(),
        };
        let messages: AgentChatMessage[] = [];
        try { messages = JSON.parse(readFileSync(agentChatPath, "utf8")); } catch {}
        messages.push(message);
        writeFileSync(agentChatPath, JSON.stringify(messages.slice(-500), null, 2));
        this.broadcast({ type: "agent-chat", payload: message });
        this.loop.emit({
          id: randomUUID(),
          type: "agent_message",
          source: `agent:${from}`,
          timestamp: message.timestamp,
          payload: message,
        });
        break;
      }
    }
  }

  private wireAdapter(): void {
    // When the event loop sends a message to the dashboard channel,
    // broadcast it to all WebSocket clients
    this.dashboardAdapter.setOutboundHandler((_target, message) => {
      this.broadcast({
        type: "chat",
        payload: {
          from: "assistant",
          text: message.text,
          timestamp: Date.now(),
        },
      });
    });
  }

  private sendTo(ws: WebSocket, msg: WsOutbound): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: WsOutbound): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  }
}
