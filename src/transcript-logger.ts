// CRC: crc-TranscriptLogger.md | Seq: seq-transcript-capture.md
// Session transcript capture and indexing
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger, Event, MessagePayload } from "./types.js";
import type { MemoryIndex } from "./memory-index.js";

interface TranscriptTurn {
  timestamp: number;
  channel: string;
  direction: "in" | "out";
  sender?: string;
  text: string;
}

export class TranscriptLogger {
  private buffer: TranscriptTurn[] = [];
  private transcriptDir: string;
  private flushIntervalMs: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;
  private memoryIndex: MemoryIndex;
  private logger: Logger;

  constructor(logger: Logger, memoryIndex: MemoryIndex, options?: {
    enabled?: boolean;
    directory?: string;
    flushIntervalMs?: number;
  }) {
    this.logger = logger;
    this.memoryIndex = memoryIndex;
    this.enabled = options?.enabled ?? true;
    this.transcriptDir = options?.directory ?? `${process.env.HOME ?? "."}/.homaruscc/transcripts`;
    this.flushIntervalMs = options?.flushIntervalMs ?? 300_000;
  }

  // CRC: crc-TranscriptLogger.md | R98, R102
  start(): void {
    if (!this.enabled) return;

    // R106: Ensure directory exists once at startup
    if (!existsSync(this.transcriptDir)) {
      mkdirSync(this.transcriptDir, { recursive: true });
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) =>
        this.logger.warn("Transcript flush failed", { error: String(err) })
      );
    }, this.flushIntervalMs);
    this.logger.info("TranscriptLogger started", { dir: this.transcriptDir, intervalMs: this.flushIntervalMs });
  }

  // CRC: crc-TranscriptLogger.md | R103
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.logger.info("TranscriptLogger stopped");
  }

  // CRC: crc-TranscriptLogger.md | R98
  logInbound(event: Event): void {
    if (!this.enabled) return;
    const payload = event.payload as MessagePayload;
    this.buffer.push({
      timestamp: event.timestamp,
      channel: payload.channel ?? event.source,
      direction: "in",
      sender: payload.from,
      text: payload.text,
    });
  }

  // CRC: crc-TranscriptLogger.md | R99
  logOutbound(channel: string, text: string): void {
    if (!this.enabled) return;
    this.buffer.push({
      timestamp: Date.now(),
      channel,
      direction: "out",
      text,
    });
  }

  // CRC: crc-TranscriptLogger.md | R100, R101, R104, R107
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const turns = this.buffer.splice(0);
    const date = new Date().toISOString().slice(0, 10);
    const filePath = join(this.transcriptDir, `${date}.md`);

    const isNewFile = !existsSync(filePath);
    const lines: string[] = [];

    if (isNewFile) {
      lines.push(`# Transcript: ${date}`, "");
    }

    for (const turn of turns) {
      const time = new Date(turn.timestamp).toTimeString().slice(0, 8);
      const label = `${turn.channel}:${turn.direction}`;
      const header = turn.sender
        ? `## ${time} [${label}] ${turn.sender}`
        : `## ${time} [${label}]`;
      lines.push(header, "", turn.text, "");
    }

    try {
      appendFileSync(filePath, lines.join("\n"));
      await this.memoryIndex.indexFile(filePath);
      this.logger.debug("Transcript flushed", { file: filePath, turns: turns.length });
    } catch (err) {
      // R107: Retain buffer on failure
      this.buffer.unshift(...turns);
      this.logger.warn("Transcript flush failed, retained buffer", { error: String(err) });
    }
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  /** Return the last N turns from the in-memory buffer (not yet flushed to disk). */
  getRecentTurns(n: number): TranscriptTurn[] {
    return this.buffer.slice(-n);
  }
}
