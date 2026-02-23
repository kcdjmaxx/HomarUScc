// CRC: crc-SessionCheckpoint.md | Seq: seq-compaction-checkpoint.md
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Logger } from "./types.js";

export interface CheckpointData {
  currentTopic?: string;
  recentDecisions?: string[];
  inProgressTask?: string;
  recentMessages?: string[];
  modifiedFiles?: string[];
  texture?: string;           // "Felt like" micro-journal — first-person subjective session quality
  highlights?: string[];      // 2-3 raw exchange snippets that exemplify the session dynamic
  anchorPhrases?: string[];   // Verbatim user quotes that carry emotional/relational weight
  timestamp?: number;
}

const MAX_DECISIONS = 10;
const MAX_MESSAGES = 5;
const MAX_HIGHLIGHTS = 5;
const MAX_ANCHORS = 5;

export class SessionCheckpoint {
  private data: CheckpointData | null = null;
  private logger: Logger;
  private filePath: string;

  constructor(logger: Logger, filePath: string) {
    this.logger = logger;
    this.filePath = filePath;
  }

  update(partial: Partial<CheckpointData>): void {
    this.data ??= {};

    if (partial.currentTopic !== undefined) this.data.currentTopic = partial.currentTopic;
    if (partial.inProgressTask !== undefined) this.data.inProgressTask = partial.inProgressTask;
    if (partial.modifiedFiles !== undefined) this.data.modifiedFiles = partial.modifiedFiles;

    if (partial.recentDecisions) {
      this.data.recentDecisions = [...(this.data.recentDecisions ?? []), ...partial.recentDecisions]
        .slice(-MAX_DECISIONS);
    }

    if (partial.recentMessages) {
      this.data.recentMessages = [...(this.data.recentMessages ?? []), ...partial.recentMessages]
        .slice(-MAX_MESSAGES);
    }

    if (partial.texture !== undefined) this.data.texture = partial.texture;

    if (partial.highlights) {
      this.data.highlights = [...(this.data.highlights ?? []), ...partial.highlights]
        .slice(-MAX_HIGHLIGHTS);
    }

    if (partial.anchorPhrases) {
      this.data.anchorPhrases = [...(this.data.anchorPhrases ?? []), ...partial.anchorPhrases]
        .slice(-MAX_ANCHORS);
    }

    this.data.timestamp = Date.now();
    this.writeToDisk();
  }

  load(): CheckpointData | null {
    try {
      if (!existsSync(this.filePath)) return null;
      const raw = readFileSync(this.filePath, "utf-8");
      this.data = JSON.parse(raw) as CheckpointData;
      return this.data;
    } catch (err) {
      this.logger.warn("Failed to load checkpoint", { error: String(err) });
      return null;
    }
  }

  clear(): void {
    this.data = null;
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
        this.logger.info("Session checkpoint cleared");
      }
    } catch (err) {
      this.logger.warn("Failed to clear checkpoint", { error: String(err) });
    }
  }

  toContextString(): string {
    if (!this.data) this.load();
    if (!this.data) return "";

    const lines: string[] = [];
    const d = this.data;

    if (d.currentTopic) lines.push(`Current topic: ${d.currentTopic}`);
    if (d.inProgressTask) lines.push(`In-progress task: ${d.inProgressTask}`);

    if (d.recentDecisions?.length) {
      lines.push("Recent decisions:");
      for (const dec of d.recentDecisions) lines.push(`  - ${dec}`);
    }

    if (d.recentMessages?.length) {
      lines.push("Recent messages:");
      for (const msg of d.recentMessages) lines.push(`  - ${msg}`);
    }

    if (d.texture) lines.push(`Session texture: ${d.texture}`);

    if (d.anchorPhrases?.length) {
      lines.push("Anchor phrases (verbatim user quotes that mattered):");
      for (const a of d.anchorPhrases) lines.push(`  "${a}"`);
    }

    if (d.highlights?.length) {
      lines.push("Raw exchange highlights:");
      for (const h of d.highlights) lines.push(`  > ${h}`);
    }

    if (d.modifiedFiles?.length) lines.push(`Modified files: ${d.modifiedFiles.join(", ")}`);
    if (d.timestamp) lines.push(`Checkpoint saved: ${new Date(d.timestamp).toISOString()}`);

    return lines.join("\n");
  }

  getData(): CheckpointData | null {
    return this.data;
  }

  private writeToDisk(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      this.logger.warn("Failed to write checkpoint", { error: String(err) });
    }
  }
}
