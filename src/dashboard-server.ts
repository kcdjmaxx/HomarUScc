// CRC: crc-DashboardServer.md | Seq: seq-event-flow.md
// Dashboard server — Express + WebSocket for the web dashboard
import { createServer, type Server as HttpServer } from "node:http";
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

interface WsMessage {
  type: "chat" | "search" | "status" | "events";
  payload: unknown;
}

interface WsOutbound {
  type: "chat" | "event" | "status" | "search_results" | "error";
  payload: unknown;
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

  constructor(logger: Logger, port: number, loop: HomarUScc, dashboardAdapter: DashboardAdapter) {
    this.logger = logger;
    this.port = port;
    this.loop = loop;
    this.dashboardAdapter = dashboardAdapter;
    this.mcpTools = createMcpTools(loop);
    this.mcpResources = createMcpResources(loop);
    this.compactionManager = new CompactionManager(loop, logger);

    this.app = express();
    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupRoutes();
    this.setupWebSocket();
    this.wireAdapter();
  }

  async start(): Promise<void> {
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

    this.app.get("/api/events", (req, res) => {
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(this.loop.getEventHistory().slice(-limit));
    });

    this.app.get("/api/timers", (_req, res) => {
      res.json(this.loop.getTimerService().getAll());
    });

    this.app.get("/api/memory/stats", (_req, res) => {
      res.json(this.loop.getMemoryIndex().getStats());
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
          res.json({
            identity: identityPayload,
            events,
            cursor: this.loop.getDeliveryWatermark(),
            compaction: { count: compactionStats.count, loopFailures: compactionStats.loopFailures },
          });
        }
      } catch {
        res.status(204).end();
      }
    });

    // --- Proxy API routes (used by mcp-proxy.ts) ---
    this.app.get("/api/health", (_req, res) => {
      res.json({ ok: true, state: "running" });
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

    // --- Apps Platform endpoints ---
    const appsDir = join(homedir(), ".homaruscc", "apps");

    this.app.get("/api/apps", (_req, res) => {
      if (!existsSync(appsDir)) { res.json([]); return; }
      const apps: unknown[] = [];
      for (const slug of readdirSync(appsDir)) {
        const manifestPath = join(appsDir, slug, "manifest.json");
        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            apps.push({ ...manifest, slug });
          } catch { /* skip invalid manifests */ }
        }
      }
      res.json(apps);
    });

    this.app.get("/api/apps/:slug/data", (req, res) => {
      const dataPath = join(appsDir, req.params.slug, "data.json");
      if (!existsSync(dataPath)) { res.json({}); return; }
      try { res.json(JSON.parse(readFileSync(dataPath, "utf8"))); }
      catch { res.json({}); }
    });

    this.app.put("/api/apps/:slug/data", express.json(), (req, res) => {
      const dataPath = join(appsDir, req.params.slug, "data.json");
      writeFileSync(dataPath, JSON.stringify(req.body, null, 2));
      res.json({ ok: true });
    });

    // Serve static files from app directories (icons, etc.)
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

    // Serve built dashboard in production
    const distPath = resolve(import.meta.dirname ?? __dirname, "../dashboard/dist");
    if (existsSync(distPath)) {
      this.app.use(express.static(distPath));
      this.app.get("*", (_req, res) => {
        res.sendFile(join(distPath, "index.html"));
      });
    }
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
