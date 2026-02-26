// CRC: crc-TelegramCommandHandler.md | Seq: seq-telegram-command.md
// Intercepts Telegram /commands and handles them at the backend level (no Claude needed)
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Logger } from "./types.js";

export interface CommandContext {
  getStatus: () => Record<string, unknown>;
  getLastWaitPoll: () => number;
  projectDir: string;
  sendTelegram: (chatId: string, text: string) => Promise<void>;
}

type CommandHandler = (chatId: string, args: string, ctx: CommandContext) => Promise<string>;

export class TelegramCommandHandler {
  private commands = new Map<string, CommandHandler>();
  private logger: Logger;
  private ctx: CommandContext;

  constructor(logger: Logger, ctx: CommandContext) {
    this.logger = logger;
    this.ctx = ctx;
    this.registerDefaults();
  }

  register(name: string, handler: CommandHandler): void {
    this.commands.set(name.toLowerCase(), handler);
  }

  async tryHandle(chatId: string, text: string): Promise<{ handled: boolean; reply?: string }> {
    const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (!match) return { handled: false };

    const command = match[1].toLowerCase();
    const args = (match[2] ?? "").trim();

    const handler = this.commands.get(command);
    if (!handler) return { handled: false };

    this.logger.info("Handling Telegram command", { command, chatId });
    try {
      const reply = await handler(chatId, args, this.ctx);
      return { handled: true, reply };
    } catch (err) {
      this.logger.error("Command handler error", { command, error: String(err) });
      return { handled: true, reply: `Command error: ${String(err)}` };
    }
  }

  private registerDefaults(): void {
    // /ping — minimal liveness check
    this.register("ping", async () => "pong");

    // /status — system health overview
    this.register("status", async (_chatId, _args, ctx) => {
      const status = ctx.getStatus();
      const lastPoll = ctx.getLastWaitPoll();
      const pollAgo = lastPoll ? Math.round((Date.now() - lastPoll) / 1000) : null;
      const claudeAlive = pollAgo !== null && pollAgo < 120;

      const channels = status.channels as Record<string, { healthy: boolean }> | undefined;
      const telegramOk = channels?.telegram?.healthy ?? false;
      const dashboardOk = channels?.dashboard?.healthy ?? false;

      const memory = status.memory as { fileCount?: number; chunkCount?: number } | undefined;
      const timers = status.timers as number;

      const lines = [
        `${status.state === "running" ? "\u{1F7E2}" : "\u{1F534}"} Backend: ${status.state}`,
        `${claudeAlive ? "\u{1F7E2}" : "\u{1F534}"} Claude: ${claudeAlive ? `connected (${pollAgo}s ago)` : pollAgo !== null ? `disconnected (${pollAgo}s ago)` : "never connected"}`,
        `${telegramOk ? "\u{1F7E2}" : "\u{1F534}"} Telegram: ${telegramOk ? "polling" : "error"}`,
        `${dashboardOk ? "\u{1F7E2}" : "\u{1F534}"} Dashboard: ${dashboardOk ? "connected" : "disconnected"}`,
        `\u{23F1} Timers: ${timers} active`,
        `\u{1F9E0} Memory: ${memory?.fileCount ?? 0} files, ${memory?.chunkCount ?? 0} chunks`,
      ];
      return lines.join("\n");
    });

    // /restart — kill claude and start new session
    this.register("restart", async (chatId, _args, ctx) => {
      const scriptPath = resolve(ctx.projectDir, "bin", "restart-claude");

      // Spawn detached — the script handles everything
      const child = spawn("bash", [scriptPath], {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          HOMARUSCC_CHAT_ID: chatId,
          HOMARUSCC_PROJECT_DIR: ctx.projectDir,
          HOMARUSCC_PORT: "3120",
        },
      });
      child.unref();

      this.logger.info("Spawned restart-claude script", { pid: child.pid });
      return "Restarting Claude Code...";
    });
  }
}
