#!/usr/bin/env node
// CRC: crc-Backend.md | Seq: seq-startup.md
// HomarUScc backend — standalone process (no MCP stdio)
// Used by mcp-proxy.ts or as a standalone server.
import { HomarUScc } from "./homaruscc.js";
import { DashboardServer } from "./dashboard-server.js";
import { DashboardAdapter } from "./dashboard-adapter.js";
import type { Logger } from "./types.js";

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

  const loop = new HomarUScc(logger, configPath);
  await loop.start();

  // Dashboard adapter (channel)
  const dashboardConfig = loop.getConfig().getAll().dashboard;
  let dashboardServer: DashboardServer | null = null;

  if (dashboardConfig?.enabled !== false) {
    const dashboardAdapter = new DashboardAdapter(logger);
    loop.getChannelManager().registerAdapter(dashboardAdapter);
    await dashboardAdapter.connect();
    dashboardAdapter.onMessage((event) => loop.emit(event));

    dashboardServer = new DashboardServer(
      logger,
      dashboardConfig?.port ?? 3120,
      loop,
      dashboardAdapter,
    );
    await dashboardServer.start();

    // Forward event loop notifications to dashboard WebSocket clients
    loop.setNotifyFn((event) => {
      dashboardServer?.broadcastEvent(event);
    });
  }

  logger.info("HomarUScc backend running (no MCP stdio)");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Backend shutting down...");
    if (dashboardServer) await dashboardServer.stop();
    await loop.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`[FATAL] ${String(err)}\n`);
  process.exit(1);
});
