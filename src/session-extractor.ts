// Session transcript extractor
// Reads Claude Code JSONL transcripts and extracts decisions, patterns, and solutions
// Stores results via MemoryIndex for long-term recall
// Designed to run during daily reflection timer

import fs from 'fs';
import path from 'path';
import type { Logger } from './types.js';
import type { MemoryIndex } from './memory-index.js';

interface TranscriptEntry {
  type: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  };
  sessionId?: string;
  timestamp?: string;
}

interface ExtractedInsight {
  category: 'decision' | 'pattern' | 'solution' | 'debugging' | 'architecture';
  key: string;
  content: string;
}

const EXTRACTION_PROMPT = `You are a session analysis system. Given a summary of a Claude Code session (assistant messages and tool calls), extract notable technical decisions, debugging solutions, architectural patterns, and workflow insights.

Rules:
- Only extract things worth remembering across future sessions
- Skip routine operations (file reads, memory searches, event loop restarts, timer handling)
- Focus on: debugging breakthroughs, architectural decisions, code patterns discovered, workflow improvements, bugs fixed and their root causes
- Each insight should be self-contained (understandable without the full session)
- If nothing notable, return an empty array

Return ONLY valid JSON array (no markdown, no explanation):
[
  {"category": "decision|pattern|solution|debugging|architecture", "key": "short-kebab-key", "content": "One or two sentence description"}
]

If nothing to extract, return: []`;

export class SessionExtractor {
  private logger: Logger;
  private memoryIndex: MemoryIndex;
  private apiKey: string;
  private model: string;
  private transcriptDir: string;
  private lastProcessedFile: string | null = null;
  private processedSessions: Set<string> = new Set();
  private stateFile: string;

  constructor(logger: Logger, memoryIndex: MemoryIndex, options?: {
    apiKey?: string;
    model?: string;
    transcriptDir?: string;
  }) {
    this.logger = logger;
    this.memoryIndex = memoryIndex;
    this.apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.model = options?.model ?? 'claude-haiku-4-5-20251001';

    // Claude Code stores transcripts here for this project
    this.transcriptDir = options?.transcriptDir ??
      path.join(process.env.HOME ?? '', '.claude/projects/-Users-maxross-Library-Mobile-Documents-iCloud-md-obsidian-Documents-Kcdjmaxx-Main-Vault-ClawdBot-homaruscc');

    this.stateFile = path.join(process.env.HOME ?? '', '.homaruscc/session-extractor-state.json');
    this.loadState();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        this.processedSessions = new Set(data.processedSessions ?? []);
        this.lastProcessedFile = data.lastProcessedFile ?? null;
      }
    } catch {
      this.logger.warn('SessionExtractor: failed to load state');
    }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify({
        processedSessions: [...this.processedSessions],
        lastProcessedFile: this.lastProcessedFile,
      }));
    } catch (err) {
      this.logger.warn('SessionExtractor: failed to save state', { error: String(err) });
    }
  }

  /** Find JSONL files modified in the last N hours */
  private findRecentTranscripts(hoursBack: number = 24): string[] {
    if (!fs.existsSync(this.transcriptDir)) return [];

    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const files = fs.readdirSync(this.transcriptDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const fullPath = path.join(this.transcriptDir, f);
        const stat = fs.statSync(fullPath);
        return { path: fullPath, mtime: stat.mtimeMs, name: f };
      })
      .filter(f => f.mtime > cutoff)
      .sort((a, b) => b.mtime - a.mtime);

    return files.map(f => f.path);
  }

  /** Parse a JSONL file and extract a condensed summary */
  private parseTranscript(filePath: string): { sessionId: string; summary: string } | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      let sessionId = path.basename(filePath, '.jsonl');
      const textBlocks: string[] = [];
      const toolCalls: string[] = [];
      let totalAssistantMsgs = 0;

      for (const line of lines) {
        try {
          const entry: TranscriptEntry = JSON.parse(line);

          if (entry.sessionId) sessionId = entry.sessionId;

          if (entry.type === 'assistant' && entry.message?.content) {
            totalAssistantMsgs++;
            const content = entry.message.content;
            if (typeof content === 'string') {
              if (content.length > 20) textBlocks.push(content);
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'text' && block.text && block.text.length > 20) {
                  textBlocks.push(block.text);
                } else if (block.type === 'tool_use' && block.name) {
                  // Skip common noise tools
                  const skip = ['mcp__homaruscc__wait_for_event', 'mcp__homaruscc__get_events'];
                  if (!skip.includes(block.name)) {
                    const inputStr = block.input ? JSON.stringify(block.input).slice(0, 100) : '';
                    toolCalls.push(`${block.name}(${inputStr})`);
                  }
                }
              }
            }
          }
        } catch {
          // Skip malformed lines
        }
      }

      if (totalAssistantMsgs < 3) return null; // Too short to be interesting

      // Build a condensed summary (target ~6000 chars for Haiku context)
      // Take text blocks evenly distributed across the session
      const selectedTexts: string[] = [];
      let charBudget = 5000;

      // Filter to meaningful blocks (skip very short ones)
      const meaningful = textBlocks.filter(t => t.length > 50);

      if (meaningful.length <= 15) {
        // Small session: include everything
        for (const text of meaningful) {
          const truncated = text.slice(0, 500);
          if (charBudget - truncated.length > 0) {
            selectedTexts.push(truncated);
            charBudget -= truncated.length;
          }
        }
      } else {
        // Large session: sample evenly (first 5, middle 5, last 5)
        const samples = [
          ...meaningful.slice(0, 5),
          ...meaningful.slice(Math.floor(meaningful.length / 2) - 2, Math.floor(meaningful.length / 2) + 3),
          ...meaningful.slice(-5),
        ];
        for (const text of samples) {
          const truncated = text.slice(0, 500);
          if (charBudget - truncated.length > 0) {
            selectedTexts.push(truncated);
            charBudget -= truncated.length;
          }
        }
      }

      // Unique tool calls (deduplicated by tool name)
      const uniqueTools = [...new Set(toolCalls.map(t => t.split('(')[0]))];

      const summary = [
        `Session: ${sessionId}`,
        `Assistant messages: ${totalAssistantMsgs}`,
        `Tools used: ${uniqueTools.join(', ')}`,
        '',
        '--- Key messages ---',
        ...selectedTexts.map((t, i) => `[${i + 1}] ${t}`),
      ].join('\n');

      return { sessionId, summary };
    } catch (err) {
      this.logger.warn('SessionExtractor: failed to parse transcript', { file: filePath, error: String(err) });
      return null;
    }
  }

  /** Call Haiku for insight extraction */
  private async callHaiku(summary: string): Promise<ExtractedInsight[]> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n--- SESSION SUMMARY ---\n${summary}`,
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
    const text = data.content?.[0]?.text ?? '[]';

    try {
      // Strip markdown code fences if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((f: unknown): f is ExtractedInsight =>
        typeof f === 'object' && f !== null &&
        'category' in f && 'key' in f && 'content' in f
      );
    } catch {
      this.logger.warn('SessionExtractor: failed to parse Haiku response', { text: text.slice(0, 200) });
      return [];
    }
  }

  /** Run extraction on recent transcripts */
  async extractRecent(hoursBack: number = 24): Promise<{ processed: number; insights: number }> {
    if (!this.apiKey) {
      this.logger.warn('SessionExtractor: No ANTHROPIC_API_KEY');
      return { processed: 0, insights: 0 };
    }

    const files = this.findRecentTranscripts(hoursBack);
    let processed = 0;
    let totalInsights = 0;

    for (const file of files) {
      const sessionId = path.basename(file, '.jsonl');
      if (this.processedSessions.has(sessionId)) continue;

      const parsed = this.parseTranscript(file);
      if (!parsed) {
        this.processedSessions.add(sessionId);
        continue;
      }

      try {
        this.logger.info('SessionExtractor: sending summary to Haiku', {
          sessionId: parsed.sessionId,
          summaryLength: parsed.summary.length,
          summaryPreview: parsed.summary.slice(0, 300),
        });
        const insights = await this.callHaiku(parsed.summary);
        this.logger.info('SessionExtractor: Haiku returned', { insights: insights.length });
        processed++;

        const categoryPrefix: Record<string, string> = {
          decision: 'local/sessions/decisions',
          pattern: 'local/sessions/patterns',
          solution: 'local/sessions/solutions',
          debugging: 'local/sessions/debugging',
          architecture: 'local/sessions/architecture',
        };

        for (const insight of insights) {
          const prefix = categoryPrefix[insight.category] ?? 'local/sessions/misc';
          const key = `${prefix}/${insight.key}`;

          // Check for duplicates
          const existing = await this.memoryIndex.search(insight.content, { limit: 1, minScore: 0.8 });
          if (existing.length > 0) {
            this.logger.debug('SessionExtractor: skipping duplicate', { key });
            continue;
          }

          await this.memoryIndex.store(insight.content, key);
          totalInsights++;
          this.logger.info('SessionExtractor: stored insight', { key, category: insight.category });
        }

        this.processedSessions.add(sessionId);
        this.lastProcessedFile = file;

        // Rate limit between files
        if (files.indexOf(file) < files.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        this.logger.warn('SessionExtractor: extraction failed for session', {
          sessionId,
          error: String(err),
        });
      }
    }

    this.saveState();
    return { processed, insights: totalInsights };
  }

  /** Get stats */
  getStats(): { processedSessions: number; transcriptDir: string } {
    return {
      processedSessions: this.processedSessions.size,
      transcriptDir: this.transcriptDir,
    };
  }
}
