// Passive fact extraction from conversation transcripts
// Uses Haiku API to extract preferences, corrections, patterns, and facts
// Stores results via MemoryIndex — zero context window cost to main agent
import type { Logger } from "./types.js";
import type { MemoryIndex } from "./memory-index.js";

interface ConversationTurn {
  timestamp: number;
  direction: "in" | "out";
  sender?: string;
  text: string;
}

interface ExtractedFact {
  category: "preference" | "correction" | "pattern" | "fact" | "decision";
  key: string;
  content: string;
}

const EXTRACTION_PROMPT = `You are a fact extraction system. Given a conversation between a user (Max) and an AI assistant (Caul), extract any notable facts, preferences, corrections, patterns, or decisions.

Rules:
- Only extract things that are worth remembering across sessions
- Skip trivial exchanges (greetings, acknowledgments, routine task confirmations)
- Skip technical implementation details that are in code files
- Focus on: user preferences, corrections to behavior, decisions made, recurring patterns, personal facts
- Each fact should be self-contained (understandable without the conversation)
- If nothing notable, return an empty array

Return ONLY valid JSON array (no markdown, no explanation):
[
  {"category": "preference|correction|pattern|fact|decision", "key": "short-kebab-key", "content": "One sentence description"}
]

If nothing to extract, return: []`;

export class FactExtractor {
  private logger: Logger;
  private memoryIndex: MemoryIndex;
  private buffer: ConversationTurn[] = [];
  private batchSize: number;
  private extractionTimer: ReturnType<typeof setTimeout> | null = null;
  private extractionDelayMs: number;
  private apiKey: string;
  private model: string;
  private enabled: boolean;
  private extractionCount = 0;
  private factCount = 0;

  constructor(logger: Logger, memoryIndex: MemoryIndex, options?: {
    enabled?: boolean;
    batchSize?: number;
    extractionDelayMs?: number;
    apiKey?: string;
    model?: string;
  }) {
    this.logger = logger;
    this.memoryIndex = memoryIndex;
    this.enabled = options?.enabled ?? true;
    this.batchSize = options?.batchSize ?? 5;
    this.extractionDelayMs = options?.extractionDelayMs ?? 60_000; // 1 min after last message
    this.apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = options?.model ?? "claude-haiku-4-5-20251001";

    if (this.enabled && !this.apiKey) {
      this.logger.warn("FactExtractor: No ANTHROPIC_API_KEY — disabling");
      this.enabled = false;
    }
  }

  /** Add a conversation turn to the buffer */
  addTurn(turn: ConversationTurn): void {
    if (!this.enabled) return;
    this.buffer.push(turn);

    // Reset the extraction timer — extract after a quiet period
    if (this.extractionTimer) clearTimeout(this.extractionTimer);
    this.extractionTimer = setTimeout(() => {
      this.maybeExtract().catch(err =>
        this.logger.warn("FactExtractor: extraction failed", { error: String(err) })
      );
    }, this.extractionDelayMs);

    // Also extract if buffer hits batch size
    if (this.buffer.length >= this.batchSize) {
      if (this.extractionTimer) clearTimeout(this.extractionTimer);
      this.maybeExtract().catch(err =>
        this.logger.warn("FactExtractor: extraction failed", { error: String(err) })
      );
    }
  }

  /** Extract facts from buffered conversation turns */
  private async maybeExtract(): Promise<void> {
    if (this.buffer.length === 0) return;

    const turns = this.buffer.splice(0);
    const conversation = turns.map(t => {
      const role = t.direction === "in" ? (t.sender ?? "User") : "Caul";
      return `${role}: ${t.text}`;
    }).join("\n");

    try {
      const facts = await this.callHaiku(conversation);
      this.extractionCount++;

      if (facts.length === 0) {
        this.logger.debug("FactExtractor: no facts extracted", { turns: turns.length });
        return;
      }

      // Store each fact
      const categoryPrefix: Record<string, string> = {
        preference: "local/user/preferences",
        correction: "local/user/corrections",
        pattern: "local/user/patterns",
        fact: "local/user/context",
        decision: "local/user/decisions",
      };

      for (const fact of facts) {
        const prefix = categoryPrefix[fact.category] ?? "local/user/context";
        const key = `${prefix}/${fact.key}`;

        // Check if similar memory already exists
        const existing = await this.memoryIndex.search(fact.content, { limit: 1, minScore: 0.8 });
        if (existing.length > 0) {
          this.logger.debug("FactExtractor: skipping duplicate", { key, existingPath: existing[0].path });
          continue;
        }

        await this.memoryIndex.store(fact.content, key);
        this.factCount++;
        this.logger.info("FactExtractor: stored fact", { key, category: fact.category });
      }
    } catch (err) {
      // On failure, put turns back in buffer for next attempt
      this.buffer.unshift(...turns);
      throw err;
    }
  }

  /** Call Haiku API for fact extraction */
  private async callHaiku(conversation: string): Promise<ExtractedFact[]> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\n--- CONVERSATION ---\n${conversation}`,
        }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Haiku API error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.text ?? "[]";

    try {
      // Strip markdown code fences if present
      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((f: unknown): f is ExtractedFact =>
        typeof f === "object" && f !== null &&
        "category" in f && "key" in f && "content" in f
      );
    } catch {
      this.logger.warn("FactExtractor: failed to parse Haiku response", { text: text.slice(0, 200) });
      return [];
    }
  }

  /** Flush any remaining buffered turns */
  async flush(): Promise<void> {
    if (this.extractionTimer) {
      clearTimeout(this.extractionTimer);
      this.extractionTimer = null;
    }
    if (this.buffer.length > 0) {
      await this.maybeExtract();
    }
  }

  /** Get stats for status endpoint */
  getStats(): { enabled: boolean; buffered: number; extractions: number; factsStored: number } {
    return {
      enabled: this.enabled,
      buffered: this.buffer.length,
      extractions: this.extractionCount,
      factsStored: this.factCount,
    };
  }
}
