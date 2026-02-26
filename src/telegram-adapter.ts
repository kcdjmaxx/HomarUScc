// CRC: crc-TelegramChannelAdapter.md | Seq: seq-event-flow.md
// Telegram adapter — from HomarUS
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { OutboundMessage, HealthStatus, Logger, ChannelConfig, DmPolicy, GroupPolicy } from "./types.js";
import { ChannelAdapter } from "./channel-adapter.js";
import type { TelegramCommandHandler } from "./telegram-command-handler.js";

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

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  entities?: TelegramMessageEntity[];
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
}

interface TelegramReactionType {
  type: "emoji" | "custom_emoji";
  emoji?: string;
  custom_emoji_id?: string;
}

interface TelegramMessageReactionUpdated {
  chat: TelegramChat;
  message_id: number;
  user?: TelegramUser;
  date: number;
  old_reaction: TelegramReactionType[];
  new_reaction: TelegramReactionType[];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  message_reaction?: TelegramMessageReactionUpdated;
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
  private mediaDir: string;
  private commandHandler: TelegramCommandHandler | null = null;

  constructor(config: TelegramAdapterConfig, logger: Logger) {
    super("telegram", logger, config.dmPolicy ?? "open", config.groupPolicy ?? "mention_required");
    this.token = config.token;
    this.pollingInterval = config.pollingInterval ?? 1000;
    this.allowedChatIds = new Set(config.allowedChatIds ?? []);
    this.mediaDir = join(homedir(), ".homaruscc", "telegram-media");
    if (!existsSync(this.mediaDir)) mkdirSync(this.mediaDir, { recursive: true });
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
    try {
      await this.apiCall("sendMessage", body);
    } catch (err) {
      // Markdown parse failures are common — retry without parse_mode
      if (String(err).includes("can't parse entities")) {
        delete body.parse_mode;
        await this.apiCall("sendMessage", body);
      } else {
        throw err;
      }
    }
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

  async sendTyping(chatId: string): Promise<void> {
    await this.apiCall("sendChatAction", { chat_id: chatId, action: "typing" });
  }

  async setReaction(chatId: string, messageId: number, emoji: string): Promise<void> {
    await this.apiCall("setMessageReaction", {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: "emoji", emoji }],
    });
  }

  async sendPhoto(chatId: string, filePath: string, caption?: string): Promise<void> {
    const { readFileSync } = await import("node:fs");
    const { basename } = await import("node:path");
    const fileData = readFileSync(filePath);
    const fileName = basename(filePath);

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", new Blob([fileData]), fileName);
    if (caption) form.append("caption", caption);

    const url = `${BASE_URL}${this.token}/sendPhoto`;
    const res = await fetch(url, { method: "POST", body: form });
    const json = (await res.json()) as TelegramResponse<unknown>;
    if (!json.ok) {
      throw new Error(`Telegram API error (sendPhoto): ${json.description ?? "unknown"}`);
    }
  }

  setCommandHandler(handler: TelegramCommandHandler): void {
    this.commandHandler = handler;
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
        allowed_updates: ["message", "edited_message", "message_reaction"],
      });

      this.lastPollOk = true;
      this.lastPollTime = Date.now();
      this.backoffMs = INITIAL_BACKOFF;

      for (const update of updates) {
        this.offset = update.update_id + 1;
        if (update.message) {
          this.handleMessage(update.message);
        } else if (update.edited_message) {
          this.handleEditedMessage(update.edited_message);
        } else if (update.message_reaction) {
          this.handleReaction(update.message_reaction);
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
    const hasMedia = msg.photo || msg.document || msg.voice;
    if (!msg.text && !hasMedia) return;

    if (this.allowedChatIds.size > 0 && !this.allowedChatIds.has(msg.chat.id)) {
      this.logger.debug("Message from non-whitelisted chat, ignoring", { chatId: msg.chat.id });
      return;
    }

    // R211: Intercept slash commands before event delivery
    if (msg.text?.startsWith("/") && this.commandHandler) {
      const chatId = String(msg.chat.id);
      this.commandHandler.tryHandle(chatId, msg.text).then((result) => {
        if (result.handled) {
          if (result.reply) {
            this.send(chatId, { text: result.reply }).catch((err) => {
              this.logger.warn("Failed to send command reply", { error: String(err) });
            });
          }
        } else {
          // R213: Unknown command — deliver as normal message
          this.deliverNormalMessage(msg);
        }
      }).catch((err) => {
        this.logger.error("Command handler error", { error: String(err) });
        // On error, still deliver the message so it's not lost
        this.deliverNormalMessage(msg);
      });
      return;
    }

    // Handle media messages asynchronously
    if (hasMedia) {
      this.handleMediaMessage(msg).catch((err) => {
        this.logger.warn("Failed to handle media message", { error: String(err) });
      });
      return;
    }

    this.deliverNormalMessage(msg);
  }

  private deliverNormalMessage(msg: TelegramMessage): void {
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    const isMention = this.detectMention(msg);
    const text = msg.text!;

    // Store for MCP read tool
    this.recentMessages.push({
      from: msg.from?.username ?? String(msg.from?.id ?? "unknown"),
      text: isMention ? this.stripMention(text) : text,
      chatId: String(msg.chat.id),
      timestamp: Date.now(),
    });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    // Send typing indicator immediately so user sees we're processing
    this.sendTyping(String(msg.chat.id)).catch(() => {});

    this.deliverWithTarget({
      from: msg.from?.username ?? String(msg.from?.id ?? "unknown"),
      channel: "telegram",
      text: isMention ? this.stripMention(text) : text,
      isGroup,
      isMention,
      replyTo: String(msg.message_id),
      raw: msg,
    }, String(msg.chat.id));
  }

  private handleEditedMessage(msg: TelegramMessage): void {
    if (!msg.text) return;
    if (this.allowedChatIds.size > 0 && !this.allowedChatIds.has(msg.chat.id)) return;

    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    const isMention = this.detectMention(msg);
    const text = isMention ? this.stripMention(msg.text) : msg.text;
    const chatId = String(msg.chat.id);

    this.sendTyping(chatId).catch(() => {});

    this.deliverWithTarget({
      from: msg.from?.username ?? String(msg.from?.id ?? "unknown"),
      channel: "telegram",
      text: `[edited message ${msg.message_id}] ${text}`,
      isGroup,
      isMention,
      replyTo: String(msg.message_id),
      raw: { ...msg, isEdit: true },
    }, chatId);
  }

  private handleReaction(reaction: TelegramMessageReactionUpdated): void {
    if (this.allowedChatIds.size > 0 && !this.allowedChatIds.has(reaction.chat.id)) {
      return;
    }

    // Extract the new emojis (what was just added)
    const newEmojis = reaction.new_reaction
      .filter((r) => r.type === "emoji" && r.emoji)
      .map((r) => r.emoji!);

    const oldEmojis = reaction.old_reaction
      .filter((r) => r.type === "emoji" && r.emoji)
      .map((r) => r.emoji!);

    // Only fire events for newly added reactions (not removals)
    const added = newEmojis.filter((e) => !oldEmojis.includes(e));
    if (added.length === 0) return;

    const from = reaction.user?.username ?? String(reaction.user?.id ?? "unknown");
    const chatId = String(reaction.chat.id);

    this.deliverWithTarget({
      from,
      channel: "telegram",
      text: `[reaction: ${added.join(" ")} on message ${reaction.message_id}]`,
      isGroup: reaction.chat.type !== "private",
      isMention: false,
      replyTo: String(reaction.message_id),
      raw: reaction,
    }, chatId);
  }

  private async handleMediaMessage(msg: TelegramMessage): Promise<void> {
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    const chatId = String(msg.chat.id);
    const from = msg.from?.username ?? String(msg.from?.id ?? "unknown");
    const caption = msg.caption ?? "";

    // Voice messages get special handling — transcribe via whisper-cpp
    if (msg.voice) {
      await this.handleVoiceMessage(msg, chatId, from, isGroup);
      return;
    }

    let fileId: string;
    let ext: string;

    if (msg.photo) {
      // Telegram sends multiple sizes — pick the largest
      const largest = msg.photo[msg.photo.length - 1];
      fileId = largest.file_id;
      ext = ".jpg";
    } else if (msg.document) {
      fileId = msg.document.file_id;
      const name = msg.document.file_name ?? "file";
      const dotIdx = name.lastIndexOf(".");
      ext = dotIdx >= 0 ? name.substring(dotIdx) : "";
    } else {
      return;
    }

    // Download the file
    const localPath = await this.downloadFile(fileId, ext);
    if (!localPath) {
      this.logger.warn("Failed to download media file", { fileId });
      return;
    }

    // Build text that tells Claude where the file is
    const mediaType = msg.photo ? "photo" : "document";
    const text = caption
      ? `[${mediaType}: ${localPath}] ${caption}`
      : `[${mediaType}: ${localPath}]`;

    this.recentMessages.push({ from, text, chatId, timestamp: Date.now() });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    this.sendTyping(chatId).catch(() => {});

    this.deliverWithTarget({
      from,
      channel: "telegram",
      text,
      isGroup,
      isMention: false,
      replyTo: String(msg.message_id),
      raw: { ...msg, localMediaPath: localPath },
    }, chatId);
  }

  private async handleVoiceMessage(
    msg: TelegramMessage,
    chatId: string,
    from: string,
    isGroup: boolean,
  ): Promise<void> {
    const voice = msg.voice!;
    this.logger.info("Voice message received", { duration: voice.duration, size: voice.file_size });

    // Download the OGG file
    const localPath = await this.downloadFile(voice.file_id, ".ogg");
    if (!localPath) {
      this.logger.warn("Failed to download voice file");
      return;
    }

    this.sendTyping(chatId).catch(() => {});

    // Transcribe via whisper-cpp
    const transcript = await this.transcribeAudio(localPath);
    if (!transcript) {
      // Fallback: deliver as audio file reference
      const text = `[voice message: ${localPath}] (transcription failed — ${voice.duration}s audio)`;
      this.deliverWithTarget({ from, channel: "telegram", text, isGroup, isMention: false, replyTo: String(msg.message_id), raw: msg }, chatId);
      return;
    }

    const text = `[voice message, ${voice.duration}s] ${transcript}`;

    this.recentMessages.push({ from, text, chatId, timestamp: Date.now() });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    this.deliverWithTarget({
      from,
      channel: "telegram",
      text,
      isGroup,
      isMention: false,
      replyTo: String(msg.message_id),
      raw: { ...msg, localMediaPath: localPath, transcript },
    }, chatId);
  }

  private async transcribeAudio(audioPath: string): Promise<string | null> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const whisperBin = "/opt/homebrew/bin/whisper-cli";
    const modelPath = join(homedir(), ".homaruscc", "models", "ggml-small.bin");

    if (!existsSync(modelPath)) {
      this.logger.warn("Whisper model not found", { modelPath });
      return null;
    }

    try {
      const { stdout } = await execFileAsync(whisperBin, [
        "-m", modelPath,
        "-f", audioPath,
        "--no-timestamps",
        "--threads", "4",
        "--language", "en",
      ], { timeout: 30000 });

      const transcript = stdout.trim();
      this.logger.info("Voice transcribed", { chars: transcript.length });
      return transcript || null;
    } catch (err) {
      this.logger.warn("Whisper transcription failed", { error: String(err) });
      return null;
    }
  }

  private async downloadFile(fileId: string, ext: string): Promise<string | null> {
    try {
      const fileInfo = await this.apiCall<TelegramFile>("getFile", { file_id: fileId });
      if (!fileInfo.file_path) return null;

      const url = `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `${Date.now()}-${fileInfo.file_unique_id}${ext}`;
      const localPath = join(this.mediaDir, filename);
      writeFileSync(localPath, buffer);

      this.logger.info("Downloaded Telegram media", { localPath, size: buffer.length });
      return localPath;
    } catch (err) {
      this.logger.warn("Telegram file download failed", { error: String(err) });
      return null;
    }
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
