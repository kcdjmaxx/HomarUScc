// CRC: crc-DashboardServer.md | Seq: seq-event-flow.md
// Dashboard server — Express + WebSocket for the web dashboard
import { createServer, type Server as HttpServer } from "node:http";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import type { Logger, Event } from "./types.js";
import type { HomarUScc } from "./homaruscc.js";
import type { DashboardAdapter } from "./dashboard-adapter.js";
import { createMcpTools, type McpToolDef } from "./mcp-tools.js";
import { createMcpResources, type McpResourceDef } from "./mcp-resources.js";

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

  constructor(logger: Logger, port: number, loop: HomarUScc, dashboardAdapter: DashboardAdapter) {
    this.logger = logger;
    this.port = port;
    this.loop = loop;
    this.dashboardAdapter = dashboardAdapter;
    this.mcpTools = createMcpTools(loop);
    this.mcpResources = createMcpResources(loop);

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
      res.json(this.loop.getStatus());
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

    // Long-poll endpoint — blocks until events arrive or timeout
    // Returns identity context alongside events so Claude re-grounds on every wake
    this.app.get("/api/wait", async (req, res) => {
      const timeout = Math.min(parseInt(req.query.timeout as string) || 30, 120) * 1000;
      try {
        const events = await this.loop.waitForEvent(timeout);
        if (events.length === 0) {
          res.status(204).end();
        } else {
          const identity = this.loop.getIdentityManager();
          res.json({
            identity: {
              soul: identity.getSoul(),
              user: identity.getUser(),
            },
            events,
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
