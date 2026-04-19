#!/usr/bin/env node
// CRC: crc-Backend.md | Seq: seq-startup.md
// HomarUScc backend — standalone process (no MCP stdio)
// Used by mcp-proxy.ts or as a standalone server.
import { resolve } from "node:path";
import { HomarUScc } from "./homaruscc.js";
import { DashboardServer } from "./dashboard-server.js";
import { DashboardAdapter } from "./dashboard-adapter.js";
import { TelegramCommandHandler } from "./telegram-command-handler.js";
import type { TelegramChannelAdapter } from "./telegram-adapter.js";
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

  // R211-R225: Wire up Telegram slash command handler
  const telegramAdapter = loop.getChannelManager().getAdapter("telegram") as TelegramChannelAdapter | undefined;
  if (telegramAdapter && dashboardServer) {
    const projectDir = resolve(import.meta.dirname ?? __dirname, "..");
    const commandHandler = new TelegramCommandHandler(logger, {
      getStatus: () => loop.getStatus(),
      getCompactionStats: () => dashboardServer!.getCompactionStats(),
      getLastWaitPoll: () => dashboardServer!.getLastWaitPoll(),
      projectDir,
      sendTelegram: async (chatId, text) => {
        await telegramAdapter.send(chatId, { text });
      },
      logMissedConflict: (domain, description) =>
        loop.getConflictMonitor().logMissedConflict(domain, description),
      resolveConflict: (id, resolution) => {
        const out = loop.getConflictMonitor().resolveById(id, resolution, "user");
        const summary = out.conflict
          ? `[${out.conflict.severity}/${out.conflict.domain}] ${out.conflict.description.slice(0, 120)}`
          : undefined;
        return { ok: out.ok, status: out.status, summary };
      },
      listOpenConflicts: (limit = 10) =>
        loop.getConflictMonitor().getOpenConflicts().slice(0, limit).map(c => ({
          id: c.id, domain: c.domain, severity: c.severity, description: c.description,
        })),
    });
    telegramAdapter.setCommandHandler(commandHandler);
    logger.info("Telegram command handler registered");
  }

  // Optional personal extensions — the file is gitignored, so a fresh clone
  // simply runs without them. Any module that default-exports or named-exports
  // `register(loop, logger)` will be loaded here.
  try {
    // String-indirection keeps the TypeScript module graph clean on clones
    // where src/personal-extensions.ts doesn't exist.
    const extPath = "./personal-extensions.js";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(extPath);
    if (typeof mod?.register === "function") {
      await mod.register(loop, logger);
      logger.info("Personal extensions registered");
    }
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      logger.debug("No personal extensions present (expected on fresh clones)");
    } else {
      logger.warn("Personal extensions failed to load", { error: msg });
    }
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
