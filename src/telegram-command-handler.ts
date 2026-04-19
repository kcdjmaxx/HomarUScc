// CRC: crc-TelegramCommandHandler.md | Seq: seq-telegram-command.md
// Intercepts Telegram /commands and handles them at the backend level (no Claude needed)
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Logger } from "./types.js";

export interface CommandContext {
  getStatus: () => Record<string, unknown>;
  getCompactionStats: () => { count: number; loopFailures: number; pending: unknown };
  getLastWaitPoll: () => number;
  projectDir: string;
  sendTelegram: (chatId: string, text: string) => Promise<void>;
  logMissedConflict?: (domain: string, description: string) => number;
  resolveConflict?: (
    id: number,
    resolution: string,
  ) => { ok: boolean; status: "resolved" | "not_found" | "already_resolved"; summary?: string };
  listOpenConflicts?: (limit?: number) => Array<{ id: number; domain: string; severity: string; description: string }>;
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

    // /compaction — show compaction counter
    this.register("compaction", async (_chatId, _args, ctx) => {
      const stats = ctx.getCompactionStats();
      return `Compactions this session: ${stats.count}\nLoop failures: ${stats.loopFailures}${stats.pending ? "\n\u26a0\ufe0f Compaction pending" : ""}`;
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

    // /nuke — kill ALL claude processes system-wide, then restart fresh
    this.register("nuke", async (chatId, _args, ctx) => {
      const scriptPath = resolve(ctx.projectDir, "bin", "nuke-claude");

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

      this.logger.info("Spawned nuke-claude script", { pid: child.pid });
      return "\u2622\ufe0f Nuking all Claude processes and restarting from scratch...";
    });

    // /missed — user flags a conflict/recall that ACC didn't catch.
    // Writes to missed_conflict_log via ConflictMonitor for recall-side tracking.
    // Usage: /missed <short description of what was missed>
    // Added 2026-04-19 as part of ACC fast-loop refinement.
    // /resolve <id> <note> — user closes an ACC conflict explicitly.
    // With no args, lists the top open conflicts with their ids.
    // Added 2026-04-19 as part of BUG-20260419-4 fix (resolver mechanism).
    this.register("resolve", async (_chatId, args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        if (!ctx.listOpenConflicts) return "ConflictMonitor not available on backend.";
        const open = ctx.listOpenConflicts(10);
        if (open.length === 0) return "No open ACC conflicts.";
        const lines = open.map(c => `#${c.id} [${c.severity}/${c.domain}] ${c.description.slice(0, 120)}`);
        return `Open conflicts:\n${lines.join("\n")}\n\nUsage: /resolve <id> <one-line note>`;
      }
      const m = trimmed.match(/^(\d+)(?:\s+(.*))?$/);
      if (!m) return "Usage: /resolve <id> <note> — or /resolve alone to list open conflicts.";
      const id = parseInt(m[1], 10);
      const note = (m[2] ?? "").trim();
      if (!note) return `Usage: /resolve ${id} <note> — a note is required so future reconsolidation can interpret the resolution.`;
      if (!ctx.resolveConflict) return "ConflictMonitor not available on backend.";
      const out = ctx.resolveConflict(id, note);
      switch (out.status) {
        case "resolved": return `Resolved #${id}. ${out.summary ?? ""}`.trim();
        case "not_found": return `No conflict #${id} in conflict_log.`;
        case "already_resolved": return `#${id} was already resolved. ${out.summary ?? ""}`.trim();
      }
      return "Unknown result.";
    });

    this.register("missed", async (_chatId, args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        return "Usage: /missed <describe what the ACC missed — a contradiction, wrong retrieval, or stored fact I didn't use>";
      }
      if (!ctx.logMissedConflict) {
        return "ConflictMonitor not available on backend.";
      }
      // Infer domain heuristically from the description keywords.
      const lower = trimmed.toLowerCase();
      let domain = "general";
      if (/max|user|kcdjmaxx|you|your/.test(lower)) domain = "user-intent";
      else if (/caul|soul|identity|who|name/.test(lower)) domain = "identity";
      else if (/dream/.test(lower)) domain = "dream";
      const id = ctx.logMissedConflict(domain, trimmed);
      return id > 0
        ? `Logged miss #${id} (domain: ${domain}). This counts toward recall tracking and will surface in the weekly conflict reconsolidation.`
        : "Failed to log miss — ConflictMonitor DB not initialized.";
    });
  }
}
