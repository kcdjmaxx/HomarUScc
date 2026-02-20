#!/usr/bin/env node
// CRC: crc-McpProxy.md | Seq: seq-startup.md
// Thin MCP proxy — stdio transport forwarding to backend HTTP API.
// Never restarts. Backend can be restarted via restart_backend tool.
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";

const BACKEND_PORT = parseInt(process.env.HOMARUSCC_PORT ?? "3120", 10);
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const WS_URL = `ws://localhost:${BACKEND_PORT}`;
const TOOL_CALL_TIMEOUT = 130_000; // 130s — covers wait_for_event's 120s max

// --- Logger (stderr only, stdout is MCP protocol) ---
function log(level: string, msg: string, meta?: Record<string, unknown>): void {
  process.stderr.write(`[${level}] [proxy] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`);
}

// --- Backend process manager ---
class BackendManager {
  private child: ChildProcess | null = null;
  private backendScript: string;

  constructor() {
    this.backendScript = resolve(import.meta.dirname ?? __dirname, "backend.js");
  }

  async spawn(): Promise<void> {
    if (this.child) return;

    log("INFO", "Spawning backend process", { script: this.backendScript });

    const env = { ...process.env };
    if (BACKEND_PORT !== 3120) {
      // Pass port through to backend via dashboard config
      // Backend reads from config, but we ensure consistency
    }

    this.child = spawn("node", [this.backendScript], {
      stdio: ["ignore", "ignore", "pipe"],
      env,
    });

    // Pipe backend stderr through to our stderr
    this.child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
    });

    this.child.on("exit", (code, signal) => {
      log("WARN", "Backend process exited", { code, signal });
      this.child = null;
    });

    // Wait for backend to become healthy
    await this.waitForHealthy();
  }

  async restart(): Promise<void> {
    log("INFO", "Restarting backend...");
    await this.stop();
    await this.spawn();
    log("INFO", "Backend restarted successfully");
  }

  async stop(): Promise<void> {
    if (!this.child) return;

    const child = this.child;
    this.child = null;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log("WARN", "Backend didn't exit gracefully, killing");
        child.kill("SIGKILL");
        resolve();
      }, 5000);

      child.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      child.kill("SIGTERM");
    });
  }

  private async waitForHealthy(): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`);
        if (res.ok) {
          log("INFO", "Backend is healthy");
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("Backend failed to become healthy within 30s");
  }
}

// --- HTTP forwarding helpers ---
async function forwardToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, args }),
      signal: AbortSignal.timeout(TOOL_CALL_TIMEOUT),
    });
    return await res.json() as { content: Array<{ type: string; text: string }>; isError?: boolean };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Backend unavailable: ${String(err)}. Use restart_backend to restart.` }],
      isError: true,
    };
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  return await res.json() as T;
}

// --- WebSocket notification relay ---
function connectNotificationWs(mcpServer: Server): void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.on("open", () => {
      log("INFO", "WebSocket connected to backend");
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; payload: unknown };
        if (msg.type === "event") {
          const event = msg.payload as { type: string; source: string; timestamp: number; id: string; payload: unknown };
          mcpServer.notification({
            method: `notifications/homaruscc/${event.type}`,
            params: {
              type: event.type,
              source: event.source,
              payload: event.payload,
              timestamp: event.timestamp,
              eventId: event.id,
            },
          }).catch(() => {});
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      log("INFO", "WebSocket disconnected from backend");
      ws = null;
      scheduleReconnect();
    });

    ws.on("error", () => {
      ws?.close();
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  connect();

  // Return cleanup function (unused for now, but available)
  return;
}

// --- restart_backend tool definition ---
const restartBackendTool = {
  name: "restart_backend",
  description: "Restart the HomarUScc backend process. Use after code changes or if the backend becomes unresponsive.",
  inputSchema: { type: "object" as const, properties: {} },
};

// --- Main ---
async function main(): Promise<void> {
  const backend = new BackendManager();

  // Spawn backend first
  await backend.spawn();

  // Create MCP server
  const server = new Server(
    { name: "homaruscc", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  // Connect WebSocket for event notifications
  connectNotificationWs(server);

  // --- MCP handlers ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const tools = await fetchJson<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>>("/api/tool-list");
      return { tools: [...tools, restartBackendTool] };
    } catch {
      return { tools: [restartBackendTool] };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "restart_backend") {
      try {
        await backend.restart();
        // Reconnect WebSocket (will auto-reconnect on close)
        connectNotificationWs(server);
        return { content: [{ type: "text", text: "Backend restarted successfully." }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to restart backend: ${String(err)}` }],
          isError: true,
        };
      }
    }

    return await forwardToolCall(name, (args ?? {}) as Record<string, unknown>);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const resources = await fetchJson<Array<{ uri: string; name: string; description: string; mimeType: string }>>("/api/resource-list");
      return { resources };
    } catch {
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    try {
      const res = await fetch(`${BACKEND_URL}/api/resource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri }),
      });
      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }
      const data = await res.json() as { uri: string; mimeType: string; text: string };
      return { contents: [data] };
    } catch (err) {
      throw new Error(`Backend unavailable: ${String(err)}. Use restart_backend to restart.`);
    }
  });

  // Connect MCP transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("INFO", "MCP proxy connected via stdio");

  // Graceful shutdown
  const shutdown = async () => {
    log("INFO", "Proxy shutting down...");
    await backend.stop();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`[FATAL] [proxy] ${String(err)}\n`);
  process.exit(1);
});
