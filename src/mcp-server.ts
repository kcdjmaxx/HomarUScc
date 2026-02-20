#!/usr/bin/env node
// HomarUScc MCP Server — stdio transport
// Claude Code connects to this as an MCP server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HomarUScc } from "./homaruscc.js";
import { createMcpTools, type McpToolDef } from "./mcp-tools.js";
import { createMcpResources, type McpResourceDef } from "./mcp-resources.js";
import { DashboardServer } from "./dashboard-server.js";
import { DashboardAdapter } from "./dashboard-adapter.js";
import type { Logger, Event, MessagePayload } from "./types.js";

// --- Logger that writes to stderr (stdout is reserved for MCP protocol) ---
const logger: Logger = {
  debug(msg, meta) {
    if (process.env.HOMARUSCC_DEBUG) {
      process.stderr.write(`[DEBUG] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`);
    }
  },
  info(msg, meta) {
    process.stderr.write(`[INFO] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`);
  },
  warn(msg, meta) {
    process.stderr.write(`[WARN] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`);
  },
  error(msg, meta) {
    process.stderr.write(`[ERROR] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`);
  },
};

async function main(): Promise<void> {
  const configPath = process.env.HOMARUSCC_CONFIG ?? undefined;

  // --- Initialize event loop ---
  const loop = new HomarUScc(logger, configPath);

  // --- Create MCP server ---
  const server = new Server(
    { name: "homaruscc", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  // --- Wire event loop notifications to MCP ---
  loop.setNotifyFn((event: Event) => {
    // Send notification to Claude Code
    const notificationType = getNotificationType(event);
    const notificationData = formatNotification(event);

    // Use MCP notification mechanism
    server.notification({
      method: `notifications/${notificationType}`,
      params: notificationData,
    }).catch((err) => {
      logger.warn("Failed to send MCP notification", { error: String(err) });
    });

    // Also forward to dashboard if connected
    dashboardServer?.broadcastEvent(event);
  });

  // --- Dashboard setup ---
  const configData = loop.getConfig().getAll();
  let dashboardServer: DashboardServer | null = null;

  // --- Start event loop ---
  await loop.start();

  // --- Dashboard adapter (channel) ---
  const dashboardConfig = loop.getConfig().getAll().dashboard;
  if (dashboardConfig?.enabled !== false) {
    const dashboardAdapter = new DashboardAdapter(logger);
    loop.getChannelManager().registerAdapter(dashboardAdapter);
    dashboardAdapter.onMessage((event) => loop.emit(event));

    dashboardServer = new DashboardServer(
      logger,
      dashboardConfig?.port ?? 3120,
      loop,
      dashboardAdapter,
    );
    await dashboardServer.start();
  }

  // --- Create tool/resource definitions ---
  const mcpTools = createMcpTools(loop);
  const mcpResources = createMcpResources(loop);

  // --- Register MCP handlers ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = mcpTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      return await tool.handler((args ?? {}) as Record<string, unknown>);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Tool error: ${String(err)}` }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: mcpResources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resource = mcpResources.find((r) => r.uri === uri);
    if (!resource) {
      throw new Error(`Unknown resource: ${uri}`);
    }
    const text = await resource.handler();
    return {
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType,
        text,
      }],
    };
  });

  // --- Connect MCP transport ---
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("HomarUScc MCP server connected via stdio");

  // --- Graceful shutdown ---
  const shutdown = async () => {
    logger.info("Shutting down...");
    if (dashboardServer) await dashboardServer.stop();
    await loop.stop();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function getNotificationType(event: Event): string {
  switch (event.type) {
    case "message": return "homaruscc/incoming_message";
    case "timer_fired": return "homaruscc/timer_fired";
    default: return `homaruscc/${event.type}`;
  }
}

function formatNotification(event: Event): Record<string, unknown> {
  if (event.type === "message") {
    const payload = event.payload as MessagePayload;
    return {
      source: payload.channel,
      from: payload.from,
      text: payload.text,
      chatId: event.source.split(":").pop() ?? "",
      timestamp: event.timestamp,
      eventId: event.id,
    };
  }
  return {
    type: event.type,
    source: event.source,
    payload: event.payload,
    timestamp: event.timestamp,
    eventId: event.id,
  };
}

main().catch((err) => {
  process.stderr.write(`[FATAL] ${String(err)}\n`);
  process.exit(1);
});
