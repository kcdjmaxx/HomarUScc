// Telegram adapter — from HomarUS
import type { OutboundMessage, HealthStatus, Logger, ChannelConfig, DmPolicy, GroupPolicy } from "./types.js";
import { ChannelAdapter } from "./channel-adapter.js";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export interface TelegramAdapterConfig {
  token: string;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  pollingInterval?: number;
  allowedChatIds?: number[];
}

const BASE_URL = "https://api.telegram.org/bot";
const POLL_TIMEOUT = 30;
const MAX_BACKOFF = 30_000;
const INITIAL_BACKOFF = 1_000;

export class TelegramChannelAdapter extends ChannelAdapter {
  private token: string;
  private botUsername = "";
  private offset = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private lastPollOk = false;
  private lastPollTime = 0;
  private backoffMs = INITIAL_BACKOFF;
  private pollingInterval: number;
  private allowedChatIds: Set<number>;
  private recentMessages: Array<{ from: string; text: string; chatId: string; timestamp: number }> = [];
  private maxRecentMessages = 50;

  constructor(config: TelegramAdapterConfig, logger: Logger) {
    super("telegram", logger, config.dmPolicy ?? "open", config.groupPolicy ?? "mention_required");
    this.token = config.token;
    this.pollingInterval = config.pollingInterval ?? 1000;
    this.allowedChatIds = new Set(config.allowedChatIds ?? []);
  }

  static fromChannelConfig(config: ChannelConfig, logger: Logger): TelegramChannelAdapter {
    if (!config.token || typeof config.token !== "string") {
      throw new Error("Telegram adapter requires a 'token' in channel config");
    }
    return new TelegramChannelAdapter({
      token: config.token,
      dmPolicy: config.dmPolicy,
      groupPolicy: config.groupPolicy,
      pollingInterval: config.pollingInterval as number | undefined,
      allowedChatIds: config.allowedChatIds as number[] | undefined,
    }, logger);
  }

  async connect(): Promise<void> {
    this.state = "connecting";
    this.stopping = false;

    const me = await this.apiCall<TelegramUser>("getMe");
    this.botUsername = me.username ?? "";
    this.logger.info("Telegram connected", { username: this.botUsername });

    this.state = "connected";
    this.backoffMs = INITIAL_BACKOFF;
    this.schedulePoll();
  }

  async disconnect(): Promise<void> {
    this.stopping = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.state = "disconnected";
    this.logger.info("Telegram disconnected");
  }

  async send(target: string, message: OutboundMessage): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: target,
      text: message.text,
      parse_mode: "Markdown",
    };
    if (message.replyTo) {
      body.reply_to_message_id = Number(message.replyTo);
    }
    await this.apiCall("sendMessage", body);
  }

  health(): HealthStatus {
    return {
      healthy: this.state === "connected" && this.lastPollOk,
      message: this.state === "connected"
        ? (this.lastPollOk ? "polling" : "poll error, retrying")
        : this.state,
      lastCheck: this.lastPollTime || Date.now(),
    };
  }

  // homaruscc addition: get recent messages for MCP tool
  getRecentMessages(limit = 20): Array<{ from: string; text: string; chatId: string; timestamp: number }> {
    return this.recentMessages.slice(-limit);
  }

  private schedulePoll(): void {
    if (this.stopping) return;
    this.pollTimer = setTimeout(() => this.poll(), this.pollingInterval);
  }

  private async poll(): Promise<void> {
    if (this.stopping) return;

    try {
      const updates = await this.apiCall<TelegramUpdate[]>("getUpdates", {
        offset: this.offset,
        timeout: POLL_TIMEOUT,
      });

      this.lastPollOk = true;
      this.lastPollTime = Date.now();
      this.backoffMs = INITIAL_BACKOFF;

      for (const update of updates) {
        this.offset = update.update_id + 1;
        if (update.message) {
          this.handleMessage(update.message);
        }
      }

      this.schedulePoll();
    } catch (err) {
      this.lastPollOk = false;
      this.lastPollTime = Date.now();
      this.logger.error("Telegram poll error", { error: String(err), backoffMs: this.backoffMs });

      if (!this.stopping) {
        this.pollTimer = setTimeout(() => this.poll(), this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF);
      }
    }
  }

  private handleMessage(msg: TelegramMessage): void {
    if (!msg.text) return;

    if (this.allowedChatIds.size > 0 && !this.allowedChatIds.has(msg.chat.id)) {
      this.logger.debug("Message from non-whitelisted chat, ignoring", { chatId: msg.chat.id });
      return;
    }

    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    const isMention = this.detectMention(msg);

    // Store for MCP read tool
    this.recentMessages.push({
      from: msg.from?.username ?? String(msg.from?.id ?? "unknown"),
      text: isMention ? this.stripMention(msg.text) : msg.text,
      chatId: String(msg.chat.id),
      timestamp: Date.now(),
    });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    this.deliverWithTarget({
      from: msg.from?.username ?? String(msg.from?.id ?? "unknown"),
      channel: "telegram",
      text: isMention ? this.stripMention(msg.text) : msg.text,
      isGroup,
      isMention,
      replyTo: String(msg.message_id),
      raw: msg,
    }, String(msg.chat.id));
  }

  private detectMention(msg: TelegramMessage): boolean {
    if (!this.botUsername || !msg.entities) return false;
    return msg.entities.some((e) => {
      if (e.type !== "mention") return false;
      const mentionText = msg.text!.substring(e.offset, e.offset + e.length);
      return mentionText.toLowerCase() === `@${this.botUsername.toLowerCase()}`;
    });
  }

  private stripMention(text: string): string {
    return text.replace(new RegExp(`@${this.botUsername}\\b`, "gi"), "").trim();
  }

  private async apiCall<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${BASE_URL}${this.token}/${method}`;
    const opts: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    };

    const res = await fetch(url, opts);
    const json = (await res.json()) as TelegramResponse<T>;

    if (!json.ok) {
      throw new Error(`Telegram API error (${method}): ${json.description ?? "unknown"}`);
    }
    return json.result;
  }
}
