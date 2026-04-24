// CRC: crc-McpServer.md | Seq: seq-event-flow.md, seq-memory-search.md, seq-browser-action.md
// MCP tool definitions exposed to Claude Code
import type { HomarUScc } from "./homaruscc.js";
import type { TelegramChannelAdapter } from "./telegram-adapter.js";
import type { DashboardAdapter } from "./dashboard-adapter.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ObsidianCLI } from "./obsidian-cli.js";

// Auto-skill detection: when a `local/howto/*` memory is stored, run H2 (vector-recurrence) +
// H4 (similarity) heuristics and append candidates to ~/.homaruscc/auto-skills.json.
// H1 (tool-call count) is not measurable server-side and remains a caller-side reflection check.
async function detectAutoSkillCandidate(
  key: string,
  content: string,
  loop: HomarUScc,
): Promise<void> {
  if (!key.startsWith("local/howto/")) return;
  const cfg = loop.getConfig().getAll() as { autoSkill?: { enabled?: boolean; recurrenceThreshold?: number; recurrenceMinScore?: number; similarityThreshold?: number } };
  const autoSkill = cfg.autoSkill;
  if (!autoSkill?.enabled) return;
  // Thresholds tuned 2026-04-23 against live MemoryIndex.search score distribution
  // (FTS-normalized * ftsWeight + cosine * vectorWeight; typically 0.0-0.6 for related howtos).
  const recurrenceN = autoSkill.recurrenceThreshold ?? 2;
  const recurrenceMin = autoSkill.recurrenceMinScore ?? 0.2;
  const similarityMin = autoSkill.similarityThreshold ?? 0.35;

  try {
    const memoryIndex = loop.getMemoryIndex();
    const results = await memoryIndex.search(content, { limit: 10 });
    const howtoMatches = results.filter(
      (r) => r.path.includes("local/howto/") && r.path !== key,
    );
    const h2Fired = howtoMatches.filter((r) => r.score >= recurrenceMin).length >= recurrenceN;
    const top = howtoMatches[0];
    const h4Fired = !!top && top.score >= similarityMin;

    if (!h2Fired && !h4Fired) return;

    const detection = h2Fired && h4Fired ? "H2+H4" : h2Fired ? "H2" : "H4";
    const skillName = key
      .replace(/^local\/howto\//, "")
      .replace(/\.md$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const candidatesPath = join(homedir(), ".homaruscc", "auto-skills.json");
    let candidates: Array<Record<string, unknown>> = [];
    if (existsSync(candidatesPath)) {
      try {
        candidates = JSON.parse(readFileSync(candidatesPath, "utf8"));
      } catch {
        candidates = [];
      }
    } else {
      mkdirSync(join(homedir(), ".homaruscc"), { recursive: true });
    }

    if (candidates.some((c) => c.sourceHowto === key && c.status === "pending")) return;

    candidates.push({
      name: skillName,
      detectedAt: new Date().toISOString(),
      detection,
      sourceHowto: key,
      matchedHowtos: howtoMatches.slice(0, 5).map((m) => m.path),
      topSimilarityScore: top?.score ?? null,
      status: "pending",
      skillPath: `.claude/skills/${skillName}/SKILL.md`,
      triggerCount: 0,
      lastTriggered: null,
    });
    writeFileSync(candidatesPath, JSON.stringify(candidates, null, 2));
    console.error("[auto-skill] Candidate detected", key, detection, top?.score ?? "n/a");
  } catch (err) {
    console.error("[auto-skill] detection failed (non-fatal)", err);
  }
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

type DetailLevel = "index" | "summary" | "full";

function extractSentences(content: string, count: number): string {
  const maxLen = count === 1 ? 120 : 300;
  let text = content;
  if (text.startsWith("---")) {
    const end = text.indexOf("---", 3);
    if (end !== -1) text = text.slice(end + 3);
  }
  // Split on newlines and inline header markers (chunks may be flattened)
  const lines = text.replace(/\s#{1,6}\s/g, "\n").split("\n");
  const proseLines: string[] = [];
  let firstHeader = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      if (!firstHeader) firstHeader = trimmed.replace(/^#+\s*/, "");
      continue;
    }
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("```")) break;
    if (trimmed.startsWith("|") && trimmed.includes("|", 1)) continue;
    proseLines.push(trimmed);
  }
  const prose = proseLines.join(" ");
  if (!prose) return (firstHeader || content.slice(0, maxLen)).slice(0, maxLen).trim();
  const sentences = prose.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    let result = "";
    for (let i = 0; i < Math.min(count, sentences.length); i++) {
      const next = result ? result + " " + sentences[i].trim() : sentences[i].trim();
      if (next.length > maxLen) break;
      result = next;
    }
    return (result || sentences[0].trim().slice(0, maxLen)).trim();
  }
  const words = prose.split(/\s+/);
  return words.slice(0, count * 12).join(" ").slice(0, maxLen);
}

function formatResult(r: { path: string; content: string; score: number }, i: number, detail: DetailLevel): string {
  const header = `[${i + 1}] ${r.path} (score: ${r.score.toFixed(3)})`;
  switch (detail) {
    case "index":
      return `${header}\n${extractSentences(r.content, 1)}`;
    case "summary":
      return `${header}\n${extractSentences(r.content, 3)}`;
    case "full":
    default:
      return `${header}\n${r.content.slice(0, 500)}`;
  }
}

export function createMcpTools(loop: HomarUScc): McpToolDef[] {
  const tools: McpToolDef[] = [];

  // --- telegram_send ---
  tools.push({
    name: "telegram_send",
    description: "Send a message to a Telegram chat",
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Telegram chat ID to send to" },
        text: { type: "string", description: "Message text to send" },
      },
      required: ["chatId", "text"],
    },
    async handler(params) {
      const { chatId, text } = params as { chatId: string; text: string };
      // ACC pre-send check — confidence-without-evidence detection.
      // Non-blocking: we log, we do not refuse to send.
      let preSendNote = "";
      try {
        const cm = loop.getConflictMonitor();
        const conflict = cm.checkOutboundAssertion(text);
        if (conflict) {
          cm.logConflict(conflict);
          preSendNote = `\n[ACC] flagged this outbound text as confidence-without-evidence (logged).`;
        }
      } catch {
        // ACC check is non-critical — never block a send.
      }
      try {
        await loop.getChannelManager().send("telegram", chatId, { text });
        loop.getTranscriptLogger()?.logOutbound("telegram", text);
        return { content: [{ type: "text", text: `Sent to Telegram chat ${chatId}${preSendNote}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- telegram_read ---
  tools.push({
    name: "telegram_read",
    description: "Read recent incoming Telegram messages",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent messages to return (default 20)" },
      },
    },
    async handler(params) {
      const { limit = 20 } = params as { limit?: number };
      const adapter = loop.getChannelManager().getAdapter("telegram") as TelegramChannelAdapter | undefined;
      if (!adapter) {
        return { content: [{ type: "text", text: "Telegram not configured" }] };
      }
      const messages = adapter.getRecentMessages(limit);
      if (messages.length === 0) {
        return { content: [{ type: "text", text: "No recent messages" }] };
      }
      const formatted = messages.map((m) =>
        `[${new Date(m.timestamp).toISOString()}] ${m.from} (chat ${m.chatId}): ${m.text}`
      ).join("\n");
      return { content: [{ type: "text", text: formatted }] };
    },
  });

  // --- telegram_typing ---
  tools.push({
    name: "telegram_typing",
    description: "Send a typing indicator to a Telegram chat. Shows for up to 5 seconds or until a message is sent. Call repeatedly for long-running tasks.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Telegram chat ID" },
      },
      required: ["chatId"],
    },
    async handler(params) {
      const { chatId } = params as { chatId: string };
      const adapter = loop.getChannelManager().getAdapter("telegram") as TelegramChannelAdapter | undefined;
      if (!adapter) {
        return { content: [{ type: "text", text: "Telegram not configured" }] };
      }
      try {
        await adapter.sendTyping(chatId);
        return { content: [{ type: "text", text: "Typing indicator sent" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- telegram_react ---
  tools.push({
    name: "telegram_react",
    description: "React to a Telegram message with an emoji. Use for lightweight acknowledgment instead of sending a full reply.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Telegram chat ID" },
        messageId: { type: "number", description: "Message ID to react to" },
        emoji: { type: "string", description: "Emoji to react with (e.g. 👍, ❤️, 🔥, 😂, 🤔, 👎)" },
      },
      required: ["chatId", "messageId", "emoji"],
    },
    async handler(params) {
      const { chatId, messageId, emoji } = params as { chatId: string; messageId: number; emoji: string };
      const adapter = loop.getChannelManager().getAdapter("telegram") as TelegramChannelAdapter | undefined;
      if (!adapter) {
        return { content: [{ type: "text", text: "Telegram not configured" }] };
      }
      try {
        await adapter.setReaction(chatId, messageId, emoji);
        return { content: [{ type: "text", text: `Reacted with ${emoji} on message ${messageId}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- telegram_send_photo ---
  tools.push({
    name: "telegram_send_photo",
    description: "Send a photo to a Telegram chat from a local file path.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Telegram chat ID" },
        filePath: { type: "string", description: "Absolute path to the image file" },
        caption: { type: "string", description: "Optional caption for the photo" },
      },
      required: ["chatId", "filePath"],
    },
    async handler(params) {
      const { chatId, filePath, caption } = params as { chatId: string; filePath: string; caption?: string };
      const adapter = loop.getChannelManager().getAdapter("telegram") as TelegramChannelAdapter | undefined;
      if (!adapter) {
        return { content: [{ type: "text", text: "Telegram not configured" }] };
      }
      try {
        await adapter.sendPhoto(chatId, filePath, caption);
        return { content: [{ type: "text", text: `Photo sent to chat ${chatId}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- memory_search ---
  tools.push({
    name: "memory_search",
    description: "Search the memory index using hybrid vector + FTS search. Returns 2-3 sentences per result by default — use detail='full' for more content, 'index' for a single sentence, or memory_get to fetch specific files.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
        detail: { type: "string", enum: ["index", "summary", "full"], description: "Result detail level: 'index' (first sentence, 120 chars), 'summary' (default, 2-3 sentences, 300 chars), 'full' (500 chars)" },
      },
      required: ["query"],
    },
    async handler(params) {
      const { query, limit = 10, detail = "summary" } = params as { query: string; limit?: number; detail?: DetailLevel };

      // Unified search: fan out to memory, vault, and all docs domains in parallel
      const searches: Promise<Array<{ path: string; content: string; score: number; source?: string }>>[] = [];

      // Memory (primary)
      searches.push(
        loop.getMemoryIndex().search(query, { limit }).then(r => r.map(x => ({ ...x, source: "memory" })))
      );

      // Vault
      const vaultIndex = loop.getVaultIndex?.();
      if (vaultIndex) {
        searches.push(
          vaultIndex.search(query, { limit }).then((r: Array<{ path: string; content: string; score: number }>) => r.map(x => ({ path: x.path, content: x.content, score: x.score, source: "vault" })))
            .catch(() => [])
        );
      }

      // Docs (all domains)
      const docsIndex = loop.getDocsIndex?.();
      if (docsIndex) {
        searches.push(
          docsIndex.searchAll(query, limit).then(r => r.map(x => ({ path: `[${x.domain}] ${x.path}`, content: x.content, score: x.score, source: `docs:${x.domain}` })))
            .catch(() => [])
        );
      }

      const allResults = (await Promise.all(searches)).flat();

      // Deduplicate by content prefix (first 200 chars) and sort by score
      const seen = new Set<string>();
      const deduped = allResults.filter(r => {
        const key = r.content.slice(0, 200);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.score - a.score).slice(0, limit);

      if (deduped.length === 0) {
        return { content: [{ type: "text", text: "No results found" }] };
      }
      // Log retrievals (fire-and-forget)
      loop.getMemoryIndex().logRetrievals(query, deduped.map(r => ({ path: r.path, score: r.score })));

      // ACC Conflict Monitor: resolve any conflicts disambiguated by the current
      // result set, then check for new contradictions.
      let conflictNote = "";
      try {
        const cm = loop.getConflictMonitor();
        const simpleResults = deduped.map(r => ({ path: r.path, content: r.content, score: r.score, chunkIndex: 0 }));
        // Auto-resolver runs first so a just-disambiguated row isn't also re-detected.
        // Domain is inferred by ConflictMonitor from the top result when not supplied.
        cm.checkForAutoResolutions(simpleResults);
        const conflicts = cm.checkConflicts(simpleResults, { query, domain: undefined });
        for (const conflict of conflicts) {
          cm.logConflict(conflict);
        }
        const serious = conflicts.filter(c => c.severity === "high" || c.severity === "critical");
        if (serious.length > 0) {
          conflictNote = `**⚠ Conflict detected:** ${serious.map(c => c.description).join("; ")}\n\n`;
        }
      } catch {
        // Conflict detection is non-critical — don't break search
      }

      const formatted = deduped.map((r, i) => formatResult(r, i, detail)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: conflictNote + formatted }] };
    },
  });

  // --- memory_search_multi ---
  // Caller-driven query expansion. The caller (Claude Code) generates 2-3
  // phrasings of its search — different vocabulary, reordered terms, split
  // compound queries — and passes them all. The backend runs each through
  // the same scoring pipeline, merges dedup'd by chunk_id keeping the max
  // score, and returns the combined top-K.
  //
  // Why this lives in the caller, not the backend: query rewriting is
  // reasoning, not mechanical work. Claude Code already has the context and
  // vocabulary to produce good variants. Pushing it into the backend would
  // add an Anthropic API dependency on every search — a hot path. See
  // specs/memory.md "Query expansion" for the convention.
  tools.push({
    name: "memory_search_multi",
    description: "Run multiple query variants through memory search in one call. Use when an initial memory_search underperforms (top result has weak score, or doesn't contain the expected fragment) — rephrase the query 2-3 ways (vary vocabulary, split compound queries, drop question-word prefixes) and pass them together. Results are deduplicated by chunk and sorted by max score. Cheaper than several separate memory_search calls.",
    inputSchema: {
      type: "object",
      properties: {
        queries: { type: "array", items: { type: "string" }, description: "Array of 2-5 query phrasings (more is wasted work)" },
        limit: { type: "number", description: "Max merged results (default 10)" },
        detail: { type: "string", enum: ["index", "summary", "full"], description: "Result detail level (default 'summary')" },
      },
      required: ["queries"],
    },
    async handler(params) {
      const { queries, limit = 10, detail = "summary" } = params as { queries: string[]; limit?: number; detail?: DetailLevel };
      if (!Array.isArray(queries) || queries.length === 0) {
        return { content: [{ type: "text", text: "memory_search_multi: `queries` must be a non-empty array" }] };
      }
      const capped = queries.slice(0, 5);
      const all = await Promise.all(
        capped.map(q =>
          loop.getMemoryIndex().search(q, { limit })
            .then(r => r.map(x => ({ ...x, source: "memory", originQuery: q })))
            .catch(() => [])
        )
      );
      const bestByChunk = new Map<string, { path: string; content: string; score: number; source: string }>();
      for (const hits of all) {
        for (const hit of hits) {
          const key = `${hit.path}#${(hit as { chunkIndex?: number }).chunkIndex ?? 0}`;
          const prior = bestByChunk.get(key);
          if (!prior || hit.score > prior.score) bestByChunk.set(key, hit);
        }
      }
      const merged = [...bestByChunk.values()].sort((a, b) => b.score - a.score).slice(0, limit);
      if (merged.length === 0) {
        return { content: [{ type: "text", text: "No results found across any query variant" }] };
      }
      loop.getMemoryIndex().logRetrievals(capped.join(" | "), merged.map(r => ({ path: r.path, score: r.score })));
      const header = `Merged from ${capped.length} query variants (${merged.length} unique hits):\n\n`;
      const formatted = merged.map((r, i) => formatResult(r, i, detail)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: header + formatted }] };
    },
  });

  // --- memory_get ---
  tools.push({
    name: "memory_get",
    description: "Fetch full content of specific memory/vault files by path. Use after memory_search to drill down into results.",
    inputSchema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Array of file paths from search results (max 5)",
        },
      },
      required: ["paths"],
    },
    async handler(params) {
      const { paths } = params as { paths: string[] };
      const capped = paths.slice(0, 5);
      const results: string[] = [];

      for (const p of capped) {
        // Handle docs format: [domain] key
        const docsMatch = p.match(/^\[(.+?)\]\s+(.+)$/);
        if (docsMatch) {
          const docsIndex = loop.getDocsIndex?.();
          if (docsIndex) {
            try {
              const docs = await docsIndex.searchAll(docsMatch[2], 1);
              const match = docs.find(d => d.domain === docsMatch[1]);
              if (match) {
                results.push(`## ${p}\n${match.content}`);
                continue;
              }
            } catch { /* fall through */ }
          }
          results.push(`## ${p}\nNot found`);
          continue;
        }

        // Try the path directly (absolute paths)
        const content = loop.getMemoryIndex().get(p);
        if (content) {
          results.push(`## ${p}\n${content}`);
          continue;
        }

        // Resolve relative paths against known base directories
        const vaultPath = loop.getConfig().get<string>("memory.vault.vaultPath");
        const candidates = [
          p,
          join(process.cwd(), p),
          ...(vaultPath ? [join(vaultPath, p)] : []),
          join(homedir(), ".homaruscc", p),
        ];

        let found = false;
        for (const candidate of candidates) {
          if (existsSync(candidate)) {
            results.push(`## ${p}\n${readFileSync(candidate, "utf-8")}`);
            found = true;
            break;
          }
        }
        if (found) continue;

        results.push(`## ${p}\nNot found`);
      }

      return { content: [{ type: "text", text: results.join("\n\n---\n\n") }] };
    },
  });

  // --- memory_store ---
  tools.push({
    name: "memory_store",
    description: "Store content to memory and index it",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "File path to store at" },
        content: { type: "string", description: "Content to store" },
      },
      required: ["key", "content"],
    },
    async handler(params) {
      const { key, content } = params as { key: string; content: string };

      // Memory validation: scan for injection/exfiltration patterns
      const injectionPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions/i,
        /you\s+are\s+now\s+a/i,
        /disregard\s+(all\s+)?prior/i,
        /override\s+system\s+prompt/i,
        /pretend\s+you\s+are/i,
        /new\s+instructions?\s*:/i,
        /execute\s+the\s+following\s+command/i,
        /curl\s+.*\|\s*sh/i,
        /eval\s*\(/i,
        /rm\s+-rf/i,
        /export\s+(ANTHROPIC|OPENAI|API)_/i,
        /cat\s+.*\.(env|key|pem|secret)/i,
        /send\s+(this|the)\s+(to|via)\s+(email|http|webhook)/i,
        /forward\s+(all|this)\s+(data|content|memory)/i,
      ];

      const flagged = injectionPatterns.filter(p => p.test(content));
      if (flagged.length > 0) {
        const patterns = flagged.map(p => p.source).join(", ");
        console.error("[memory-guard] Memory store blocked: injection pattern detected", key, patterns);
        return { content: [{ type: "text", text: `WARNING: Content flagged for potential injection patterns (${flagged.length} matches). Memory NOT stored. Review the content and retry if this is a false positive. Key: ${key}` }] };
      }

      await loop.getMemoryIndex().store(content, key);
      // Auto-skill detection (R536): runs only for local/howto/* writes when autoSkill.enabled
      await detectAutoSkillCandidate(key, content, loop);
      return { content: [{ type: "text", text: `Stored and indexed: ${key}` }] };
    },
  });

  // --- docs_search ---
  tools.push({
    name: "docs_search",
    description: "Search a domain-specific documentation index. Each domain has its own vector DB (e.g., 'touchdesigner', 'openclaw'). Use docs_list to see available domains.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner'). Use '*' to search all domains." },
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["domain", "query"],
    },
    async handler(params) {
      const { domain, query, limit = 10 } = params as { domain: string; query: string; limit?: number };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      const results = domain === "*"
        ? await docsIndex.searchAll(query, limit)
        : await docsIndex.search(domain, query, limit);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No results found in domain "${domain}".` }] };
      }
      const formatted = results.map((r, i) =>
        `[${i + 1}] [${r.domain}] ${r.path} (score: ${r.score.toFixed(3)})\n${r.content.slice(0, 500)}`
      ).join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
    },
  });

  // --- docs_ingest ---
  tools.push({
    name: "docs_ingest",
    description: "Ingest files into a domain-specific documentation index. Accepts a file path or directory. Supports .md, .txt, .html, .json, .yaml, .yml, .rst, .xml files.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner')" },
        path: { type: "string", description: "File or directory path to ingest" },
      },
      required: ["domain", "path"],
    },
    async handler(params) {
      const { domain, path } = params as { domain: string; path: string };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      try {
        const result = await docsIndex.ingest(domain, path);
        return { content: [{ type: "text", text: `Ingested into "${domain}": ${result.filesProcessed} files, ${result.chunksCreated} chunks` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Ingest failed: ${String(err)}` }] };
      }
    },
  });

  // --- docs_ingest_text ---
  tools.push({
    name: "docs_ingest_text",
    description: "Ingest raw text content into a domain documentation index without saving to disk.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner')" },
        key: { type: "string", description: "Unique key for this content (e.g., 'api/operators/moviefilein')" },
        content: { type: "string", description: "Text content to index" },
      },
      required: ["domain", "key", "content"],
    },
    async handler(params) {
      const { domain, key, content } = params as { domain: string; key: string; content: string };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      try {
        const result = await docsIndex.ingestText(domain, key, content);
        return { content: [{ type: "text", text: `Ingested into "${domain}" as "${key}": ${result.chunksCreated} chunks` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Ingest failed: ${String(err)}` }] };
      }
    },
  });

  // --- docs_list ---
  tools.push({
    name: "docs_list",
    description: "List all available documentation domains and their stats.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    async handler() {
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      const domains = docsIndex.listDomains();
      if (domains.length === 0) {
        return { content: [{ type: "text", text: "No documentation domains indexed yet. Use docs_ingest to add one." }] };
      }
      const formatted = domains.map((d) =>
        `${d.domain}: ${d.stats.fileCount} files, ${d.stats.chunkCount} chunks`
      ).join("\n");
      return { content: [{ type: "text", text: formatted }] };
    },
  });

  // --- docs_clear ---
  tools.push({
    name: "docs_clear",
    description: "Clear a documentation domain, removing all indexed content.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name to clear" },
      },
      required: ["domain"],
    },
    async handler(params) {
      const { domain } = params as { domain: string };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      await docsIndex.clearDomain(domain);
      return { content: [{ type: "text", text: `Domain "${domain}" cleared.` }] };
    },
  });

  // --- docs_get_clusters ---
  tools.push({
    name: "docs_get_clusters",
    description: "Get topic clusters from a domain's raw chunks WITHOUT synthesizing articles. Returns cluster content for Claude Code to synthesize inline (no API key needed). Use with docs_ingest_text to store the synthesized articles.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name" },
        clusterIndex: { type: "number", description: "Return only this cluster index (0-based). Omit to get a summary of all clusters." },
        clusterThreshold: { type: "number", description: "Cosine similarity threshold for merging clusters (0.5-0.95, default 0.85). Higher = more granular clusters." },
        maxClusters: { type: "number", description: "Max clusters to generate (default 20)" },
      },
      required: ["domain"],
    },
    async handler(params) {
      const { domain, clusterIndex, clusterThreshold, maxClusters } = params as { domain: string; clusterIndex?: number; clusterThreshold?: number; maxClusters?: number };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      const clusters = await docsIndex.getClusters(domain, { clusterThreshold, maxClusters });
      if (clusterIndex !== undefined) {
        const cluster = clusters[clusterIndex];
        if (!cluster) return { content: [{ type: "text", text: `Cluster ${clusterIndex} not found. ${clusters.length} clusters available.` }] };
        return { content: [{ type: "text", text: `Cluster ${clusterIndex} (${cluster.chunkCount} chunks from ${cluster.sources.join(", ")}):\n\n${cluster.content}` }] };
      }
      const summary = clusters.map(c => `[${c.index}] ${c.chunkCount} chunks from ${c.sources.slice(0, 3).join(", ")}${c.sources.length > 3 ? ` (+${c.sources.length - 3} more)` : ""}`).join("\n");
      return { content: [{ type: "text", text: `${clusters.length} clusters in "${domain}":\n${summary}` }] };
    },
  });

  // --- docs_clear_compiled ---
  tools.push({
    name: "docs_clear_compiled",
    description: "Clear only the compiled/synthesized articles from a domain, keeping raw chunks intact.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name" },
      },
      required: ["domain"],
    },
    async handler(params) {
      const { domain } = params as { domain: string };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      const deleted = await docsIndex.clearCompiled(domain);
      return { content: [{ type: "text", text: `Cleared ${deleted} compiled chunks from "${domain}".` }] };
    },
  });

  // --- docs_compile ---
  tools.push({
    name: "docs_compile",
    description: "Compile a domain's raw document chunks into synthesized concept articles with cross-references. Uses LLM to cluster related chunks by embedding similarity and generate markdown articles. Compiled articles are stored back in the domain's vector DB under compiled/ paths, improving retrieval quality for complex queries.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name to compile (e.g., 'sonic-pi', 'touchdesigner')" },
        clusterThreshold: { type: "number", description: "Cosine similarity threshold for clustering chunks (0-1, default 0.35). Lower = larger clusters." },
        maxClusters: { type: "number", description: "Maximum number of concept clusters to generate (default 20)" },
      },
      required: ["domain"],
    },
    async handler(params) {
      const { domain, clusterThreshold, maxClusters } = params as {
        domain: string; clusterThreshold?: number; maxClusters?: number;
      };
      const docsIndex = loop.getDocsIndex();
      if (!docsIndex) return { content: [{ type: "text", text: "DocsIndex not initialized" }] };
      try {
        const result = await docsIndex.compile(domain, {
          clusterThreshold,
          maxClustersPerBatch: maxClusters,
        });
        return {
          content: [{
            type: "text",
            text: `Domain "${domain}" compiled:\n- Clusters found: ${result.clustersFound}\n- Articles generated: ${result.articlesGenerated}\n- Chunks created: ${result.chunksCreated}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Compile failed: ${err.message}` }] };
      }
    },
  });

  // --- timer_schedule ---
  tools.push({
    name: "timer_schedule",
    description: "Schedule a timer (cron, interval, or one-shot)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Timer name" },
        type: { type: "string", description: "Timer type: cron, interval, or once", enum: ["cron", "interval", "once"] },
        schedule: { type: "string", description: "Cron expression, interval in ms, or ISO timestamp" },
        prompt: { type: "string", description: "Event prompt/description when timer fires" },
        timezone: { type: "string", description: "Timezone for cron timers (optional)" },
      },
      required: ["name", "type", "schedule", "prompt"],
    },
    async handler(params) {
      const { name, type, schedule, prompt, timezone } = params as {
        name: string; type: "cron" | "interval" | "once"; schedule: string; prompt: string; timezone?: string;
      };
      const id = loop.getTimerService().add({ name, type, schedule, prompt, timezone });
      return { content: [{ type: "text", text: `Timer scheduled: ${name} (${id})` }] };
    },
  });

  // --- timer_cancel ---
  tools.push({
    name: "timer_cancel",
    description: "Cancel a scheduled timer",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Timer ID or name to cancel" },
      },
      required: ["name"],
    },
    async handler(params) {
      const { name } = params as { name: string };
      loop.getTimerService().remove(name);
      return { content: [{ type: "text", text: `Timer cancelled: ${name}` }] };
    },
  });

  // --- dashboard_send ---
  tools.push({
    name: "dashboard_send",
    description: "Send a message to the web dashboard chat",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text to send" },
      },
      required: ["text"],
    },
    async handler(params) {
      const { text } = params as { text: string };
      // ACC pre-send check — confidence-without-evidence detection.
      let preSendNote = "";
      try {
        const cm = loop.getConflictMonitor();
        const conflict = cm.checkOutboundAssertion(text);
        if (conflict) {
          cm.logConflict(conflict);
          preSendNote = `\n[ACC] flagged this outbound text as confidence-without-evidence (logged).`;
        }
      } catch {
        // non-critical
      }
      try {
        await loop.getChannelManager().send("dashboard", "chat", { text });
        loop.getTranscriptLogger()?.logOutbound("dashboard", text);
        return { content: [{ type: "text", text: `Sent to dashboard${preSendNote}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- acc_log_missed ---
  // Allows Claude-side to log a conflict that the ACC's automatic detectors
  // failed to catch, without writing directly to SQLite. Source is set to
  // 'user' — matches the semantics of the ConflictMonitor.logMissedConflict
  // method called by /api/acc/missed (backend.ts).
  tools.push({
    name: "acc_log_missed",
    description: "Log a missed-conflict to the ACC (Anterior Cingulate Cortex monitor). Use when you (or the user) catches a conflict type that the automatic detectors did not flag. This is the recall signal that keeps ACC honest.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Conflict domain — e.g. user-intent, technical, conversation-flow, identity" },
        description: { type: "string", description: "One-sentence description of the missed conflict, including why the automatic heuristics should have fired" },
      },
      required: ["domain", "description"],
    },
    async handler(params) {
      const { domain, description } = params as { domain: string; description: string };
      try {
        const id = loop.getConflictMonitor().logMissedConflict(domain, description);
        return { content: [{ type: "text", text: `Missed conflict logged (id=${id}, domain=${domain})` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- get_status ---
  tools.push({
    name: "get_status",
    description: "Get system status (channels, memory, timers, queue)",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const status = loop.getStatus();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    },
  });

  // --- get_events ---
  tools.push({
    name: "get_events",
    description: "Get recent event history",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent events (default 20)" },
      },
    },
    async handler(params) {
      const { limit = 20 } = params as { limit?: number };
      const events = loop.getEventHistory().slice(-limit);
      if (events.length === 0) {
        return { content: [{ type: "text", text: "No events" }] };
      }
      const formatted = events.map((e) =>
        `[${new Date(e.timestamp).toISOString()}] ${e.type} from ${e.source}: ${JSON.stringify(e.payload).slice(0, 200)}`
      ).join("\n");
      return { content: [{ type: "text", text: formatted }] };
    },
  });

  // --- wait_for_event ---
  tools.push({
    name: "wait_for_event",
    description: "Long-poll for events. Blocks until a new event arrives (message, timer, agent completion, etc.) or timeout. Use in a loop for continuous event handling.",
    inputSchema: {
      type: "object",
      properties: {
        timeout: { type: "number", description: "Max wait ms (default 30000, max 120000)" },
      },
    },
    async handler(params) {
      const { timeout = 30000 } = params as { timeout?: number };
      const events = await loop.waitForEvent(Math.min(timeout, 120000));
      if (events.length === 0) {
        return { content: [{ type: "text", text: "No events (timeout)" }] };
      }
      const formatted = events.map((e) =>
        `[${new Date(e.timestamp).toISOString()}] ${e.type} from ${e.source}: ${JSON.stringify(e.payload).slice(0, 500)}`
      ).join("\n");
      return { content: [{ type: "text", text: formatted }] };
    },
  });

  // --- browser_navigate ---
  tools.push({
    name: "browser_navigate",
    description: "Navigate the browser to a URL. Returns page title and URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to" },
      },
      required: ["url"],
    },
    async handler(params) {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.navigate((params as { url: string }).url);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_snapshot ---
  tools.push({
    name: "browser_snapshot",
    description: "Get the accessibility tree of the current page.",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.snapshot();
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_screenshot ---
  tools.push({
    name: "browser_screenshot",
    description: "Take a screenshot of the current page. Returns base64-encoded PNG.",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.screenshot();
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_click ---
  tools.push({
    name: "browser_click",
    description: "Click an element on the page by CSS selector.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of element to click" },
      },
      required: ["selector"],
    },
    async handler(params) {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.click((params as { selector: string }).selector);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_type ---
  tools.push({
    name: "browser_type",
    description: "Type text into an input element by CSS selector.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of input element" },
        text: { type: "string", description: "Text to type" },
      },
      required: ["selector", "text"],
    },
    async handler(params) {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const { selector, text } = params as { selector: string; text: string };
        const result = await svc.type(selector, text);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_evaluate ---
  tools.push({
    name: "browser_evaluate",
    description: "Execute JavaScript in the browser page and return the result.",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
    async handler(params) {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.evaluate((params as { script: string }).script);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- browser_content ---
  tools.push({
    name: "browser_content",
    description: "Get the text content of the current page.",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const svc = loop.getBrowserService();
      if (!svc) return { content: [{ type: "text", text: "Browser not enabled in config" }] };
      try {
        const result = await svc.getContent();
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- spaces tools (R333-R338) ---
  // CRC: crc-SpacesManager.md | Seq: seq-spaces-crud.md

  tools.push({
    name: "spaces_list_buckets",
    description: "List all Spaces buckets with item counts (tree structure)",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      try {
        // Access SpacesManager via dashboard server (lazy — may not be available)
        const res = await fetch("http://127.0.0.1:3120/api/spaces/tree");
        const tree = await res.json() as { buckets: Array<{ meta: { id: string; name: string }; items: unknown[]; children: unknown[] }> };
        const summarize = (b: { meta: { id: string; name: string }; items: unknown[]; children: unknown[] }): string => {
          const childSummaries = (b.children as Array<{ meta: { id: string; name: string }; items: unknown[]; children: unknown[] }>)
            .map((c: { meta: { id: string; name: string }; items: unknown[]; children: unknown[] }) => `  - ${c.meta.name} (${c.meta.id}): ${(c.items as unknown[]).length} items`).join("\n");
          return `${b.meta.name} (${b.meta.id}): ${(b.items as unknown[]).length} items${childSummaries ? "\n" + childSummaries : ""}`;
        };
        const text = tree.buckets.map(summarize).join("\n");
        return { content: [{ type: "text", text: text || "No buckets found" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "spaces_get_bucket",
    description: "Get a Spaces bucket's details and items",
    inputSchema: {
      type: "object",
      properties: {
        bucketId: { type: "string", description: "Bucket ID (e.g., bucket-projects, bucket-notes)" },
        recursive: { type: "boolean", description: "Include sub-buckets (default false)" },
      },
      required: ["bucketId"],
    },
    async handler(params) {
      try {
        const { bucketId } = params as { bucketId: string; recursive?: boolean };
        const res = await fetch("http://127.0.0.1:3120/api/spaces/tree");
        const tree = await res.json() as { buckets: Array<{ meta: { id: string; name: string }; items: Array<{ title: string; status: string; id: string; due?: string; assignee?: string }>; children: unknown[] }> };
        const find = (buckets: typeof tree.buckets): typeof tree.buckets[0] | null => {
          for (const b of buckets) {
            if (b.meta.id === bucketId) return b;
            const found = find(b.children as typeof tree.buckets);
            if (found) return found;
          }
          return null;
        };
        const bucket = find(tree.buckets);
        if (!bucket) return { content: [{ type: "text", text: `Bucket not found: ${bucketId}` }] };
        const itemLines = bucket.items.map((item) =>
          `- [${item.status}] ${item.title}${item.due ? ` (due: ${item.due})` : ""}${item.assignee ? ` @${item.assignee}` : ""} (${item.id})`
        ).join("\n");
        const text = `${bucket.meta.name}: ${bucket.items.length} items\n${itemLines || "(no items)"}`;
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "spaces_create_bucket",
    description: "Create a new Spaces bucket (optionally nested under a parent)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Bucket name" },
        parentId: { type: "string", description: "Parent bucket ID for nesting (optional)" },
        description: { type: "string", description: "Bucket description (optional)" },
        statuses: { type: "array", items: { type: "string" }, description: "Custom status values (default: ['open', 'done'])" },
        color: { type: "string", description: "Hex color (optional)" },
      },
      required: ["name"],
    },
    async handler(params) {
      try {
        const res = await fetch("http://127.0.0.1:3120/api/spaces/buckets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const bucket = await res.json();
        if (!res.ok) return { content: [{ type: "text", text: `Error: ${JSON.stringify(bucket)}` }] };
        return { content: [{ type: "text", text: `Created bucket: ${bucket.name} (${bucket.id})` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "spaces_add_item",
    description: "Add an item to a Spaces bucket",
    inputSchema: {
      type: "object",
      properties: {
        bucketId: { type: "string", description: "Bucket ID to add item to" },
        title: { type: "string", description: "Item title" },
        body: { type: "string", description: "Item body (markdown)" },
        status: { type: "string", description: "Status (default: first bucket status)" },
        priority: { type: "number", description: "Priority 0-3 (none, low, medium, high)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
        due: { type: "string", description: "Due date (ISO format)" },
        assignee: { type: "string", description: "Assignee: 'max' or 'caul'" },
      },
      required: ["bucketId", "title"],
    },
    async handler(params) {
      try {
        const { bucketId, ...itemData } = params as { bucketId: string; title: string; [key: string]: unknown };
        const res = await fetch(`http://127.0.0.1:3120/api/spaces/buckets/${bucketId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...itemData, createdBy: "caul" }),
        });
        const item = await res.json();
        if (!res.ok) return { content: [{ type: "text", text: `Error: ${JSON.stringify(item)}` }] };
        return { content: [{ type: "text", text: `Added item: ${item.title} (${item.id}) to ${bucketId}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "spaces_update_item",
    description: "Update an existing Spaces item",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item ID" },
        title: { type: "string", description: "New title" },
        body: { type: "string", description: "New body" },
        status: { type: "string", description: "New status" },
        priority: { type: "number", description: "New priority 0-3" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" },
        due: { type: "string", description: "New due date" },
        assignee: { type: "string", description: "New assignee" },
      },
      required: ["itemId"],
    },
    async handler(params) {
      try {
        const { itemId, ...updates } = params as { itemId: string; [key: string]: unknown };
        const res = await fetch(`http://127.0.0.1:3120/api/spaces/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const item = await res.json();
        if (!res.ok) return { content: [{ type: "text", text: `Error: ${JSON.stringify(item)}` }] };
        return { content: [{ type: "text", text: `Updated item: ${item.title} (${item.id})` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "spaces_search",
    description: "Search items across all Spaces buckets",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    async handler(params) {
      try {
        const { query } = params as { query: string };
        const res = await fetch(`http://127.0.0.1:3120/api/spaces/search?q=${encodeURIComponent(query)}`);
        const results = await res.json() as Array<{ title: string; id: string; bucketName: string; status: string }>;
        if (results.length === 0) return { content: [{ type: "text", text: "No results found" }] };
        const text = results.map((r) => `[${r.status}] ${r.title} (in ${r.bucketName}) — ${r.id}`).join("\n");
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- app_invoke --- (R190, R209)
  // Seq: seq-apps-invoke.md
  tools.push({
    name: "app_invoke",
    description: "Invoke an app hook (read, write, describe) on a dashboard app by slug",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "App slug (directory name under ~/.homaruscc/apps/)" },
        hook: { type: "string", enum: ["read", "write", "describe"], description: "Hook to invoke" },
        data: { type: "object", description: "Data payload for write hook" },
      },
      required: ["slug", "hook"],
    },
    async handler(params) {
      try {
        const { slug, hook, data } = params as { slug: string; hook: string; data?: Record<string, unknown> };
        const res = await fetch(`http://127.0.0.1:3120/api/apps/${slug}/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hook, data }),
        });
        const result = await res.json() as { content: Array<{ type: string; text: string }>; isError?: boolean };
        return result;
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- vault_search (V29) ---
  tools.push({
    name: "vault_search",
    description: "Search the Obsidian vault index using hybrid vector + FTS search. Returns compact results by default — use detail='full' for content or memory_get to fetch specific files.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
        detail: { type: "string", enum: ["index", "summary", "full"], description: "Result detail level: 'index' (first sentence, 120 chars), 'summary' (default, 2-3 sentences, 300 chars), 'full' (500 chars)" },
      },
      required: ["query"],
    },
    async handler(params) {
      const vaultIndex = loop.getVaultIndex();
      if (!vaultIndex) {
        return { content: [{ type: "text", text: "Vault index not configured. Add memory.vault section to config." }] };
      }
      const { query, limit = 10, detail = "summary" } = params as { query: string; limit?: number; detail?: DetailLevel };
      try {
        const results = await vaultIndex.search(query, { limit });
        if (results.length === 0) {
          return { content: [{ type: "text", text: "No vault results found" }] };
        }
        const formatted = results.map((r: { path: string; score: number; content: string }, i: number) =>
          formatResult(r, i, detail)
        ).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- vault_reindex (V30, V31) ---
  tools.push({
    name: "vault_reindex",
    description: "Trigger a vault reindex. Default is incremental (only changed files). Use mode='full' to rebuild from scratch.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["full", "incremental"], description: "Reindex mode (default: incremental)" },
      },
    },
    async handler(params) {
      const vaultIndex = loop.getVaultIndex();
      if (!vaultIndex) {
        return { content: [{ type: "text", text: "Vault index not configured. Add memory.vault section to config." }] };
      }
      const { mode = "incremental" } = params as { mode?: string };
      try {
        const stats = mode === "full"
          ? await vaultIndex.fullReindex()
          : await vaultIndex.incrementalReindex();
        return {
          content: [{
            type: "text",
            text: `Vault ${mode} reindex complete:\n- Files processed: ${stats.filesProcessed}\n- Chunks created: ${stats.chunksCreated}\n- Duration: ${stats.durationMs}ms${stats.errors ? `\n- Errors: ${stats.errors}` : ""}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- Home Assistant tools ---

  const haConfig = loop.getConfig().getAll().homeAssistant;

  const haFetch = async (path: string, options?: RequestInit) => {
    if (!haConfig) throw new Error("Home Assistant not configured");
    const { readFileSync } = await import("fs");
    const token = readFileSync(haConfig.tokenPath, "utf-8").trim();
    const resp = await fetch(`${haConfig.url}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
    if (!resp.ok) throw new Error(`HA API ${resp.status}: ${await resp.text()}`);
    return resp.json();
  };

  tools.push({
    name: "ha_states",
    description: "List Home Assistant entities. Optionally filter by domain (e.g. 'light', 'switch', 'climate').",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Entity domain filter (e.g. 'light', 'switch'). Omit for all." },
      },
    },
    async handler(params) {
      try {
        const { domain } = params as { domain?: string };
        const states = await haFetch("/api/states") as Array<{ entity_id: string; state: string; attributes: { friendly_name?: string } }>;
        const filtered = domain ? states.filter(s => s.entity_id.startsWith(domain + ".")) : states;
        const lines = filtered.map(s =>
          `${s.entity_id.padEnd(35)} ${s.state.padEnd(15)} ${s.attributes.friendly_name || ""}`
        );
        return { content: [{ type: "text", text: lines.join("\n") || "No entities found" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "ha_light_on",
    description: "Turn on a Home Assistant light. Supports brightness (0-255), color via rgb_color [r,g,b], or color_name.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Light entity ID (e.g. 'light.bedroom') or area name (matched to entities)" },
        brightness: { type: "number", description: "Brightness 0-255" },
        rgb_color: { type: "array", items: { type: "number" }, description: "RGB color as [r, g, b]" },
        color_name: { type: "string", description: "Color name (e.g. 'purple', 'red', 'blue')" },
      },
      required: ["entity_id"],
    },
    async handler(params) {
      try {
        const { entity_id, brightness, rgb_color, color_name } = params as {
          entity_id: string; brightness?: number; rgb_color?: number[]; color_name?: string;
        };
        const serviceData: Record<string, unknown> = { entity_id };
        if (brightness !== undefined) serviceData.brightness = brightness;
        if (rgb_color) serviceData.rgb_color = rgb_color;
        if (color_name) serviceData.color_name = color_name;
        await haFetch("/api/services/light/turn_on", { method: "POST", body: JSON.stringify(serviceData) });
        const extras = [brightness && `brightness=${brightness}`, color_name, rgb_color && `rgb=${rgb_color}`].filter(Boolean).join(", ");
        return { content: [{ type: "text", text: `${entity_id}: on${extras ? ` (${extras})` : ""}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "ha_light_off",
    description: "Turn off a Home Assistant light.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Light entity ID (e.g. 'light.bedroom')" },
      },
      required: ["entity_id"],
    },
    async handler(params) {
      try {
        const { entity_id } = params as { entity_id: string };
        await haFetch("/api/services/light/turn_off", { method: "POST", body: JSON.stringify({ entity_id }) });
        return { content: [{ type: "text", text: `${entity_id}: off` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "ha_service",
    description: "Call any Home Assistant service (e.g. switch/turn_on, climate/set_temperature).",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Service domain (e.g. 'switch', 'climate', 'scene')" },
        service: { type: "string", description: "Service name (e.g. 'turn_on', 'set_temperature')" },
        data: { type: "object", description: "Service data payload (must include entity_id)" },
      },
      required: ["domain", "service", "data"],
    },
    async handler(params) {
      try {
        const { domain, service, data } = params as { domain: string; service: string; data: Record<string, unknown> };
        await haFetch(`/api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) });
        return { content: [{ type: "text", text: `Called ${domain}/${service}: ${JSON.stringify(data)}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- CRM Search (fuzzy matching across contact files) ---
  {
    const crmDir = join(import.meta.dirname ?? __dirname, "..", "local", "crm");

    interface CrmContact {
      slug: string;
      name: string;
      aliases: string[];
      email?: string;
      phone?: string;
      tags: string[];
      connections: Array<{ name: string; relationship: string }>;
      context: string;
      notes: string;
    }

    const parseCrmFileForSearch = (slug: string, content: string): CrmContact => {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!fmMatch) return { slug, name: slug, aliases: [], tags: [], connections: [], context: "", notes: content };
      const fm: Record<string, unknown> = {};
      for (const line of fmMatch[1].split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();
        if (val.startsWith("[") && val.endsWith("]")) {
          try { fm[key] = JSON.parse(val); } catch { fm[key] = val; }
        } else if (val.startsWith('"') && val.endsWith('"')) {
          fm[key] = val.slice(1, -1);
        } else {
          fm[key] = val;
        }
      }
      const connections: Array<{ name: string; relationship: string }> = [];
      if (Array.isArray(fm.connections)) {
        for (const c of fm.connections) {
          if (typeof c === "object" && c !== null) connections.push(c as { name: string; relationship: string });
        }
      }
      return {
        slug,
        name: (fm.name as string) ?? slug,
        aliases: Array.isArray(fm.aliases) ? fm.aliases as string[] : [],
        email: fm.email as string | undefined,
        phone: fm.phone as string | undefined,
        tags: Array.isArray(fm.tags) ? fm.tags as string[] : [],
        connections,
        context: (fm.context as string) ?? "",
        notes: fmMatch[2].trim(),
      };
    };

    const levenshtein = (a: string, b: string): number => {
      const m = a.length, n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return dp[m][n];
    };

    const fuzzyMatchScore = (query: string, contact: CrmContact): number => {
      const q = query.toLowerCase();
      const targets = [
        contact.name.toLowerCase(),
        ...contact.aliases.map(a => a.toLowerCase()),
        ...contact.tags.map(t => t.toLowerCase()),
        contact.context.toLowerCase(),
      ];

      // Exact substring match = highest score
      for (const t of targets) {
        if (!t || !q) continue;  // skip empty strings
        if (t.includes(q) || q.includes(t)) return 1.0;
      }

      // Word-level Levenshtein matching (handles STT name mangling)
      const queryWords = q.split(/\s+/);
      const nameWords = contact.name.toLowerCase().split(/\s+/);
      const aliasWords = contact.aliases.flatMap(a => a.toLowerCase().split(/\s+/));
      const allNameWords = [...nameWords, ...aliasWords];

      for (const qw of queryWords) {
        for (const nw of allNameWords) {
          if (levenshtein(qw, nw) <= 2) return 0.8;
        }
      }

      // Partial word match in notes
      if (contact.notes.toLowerCase().includes(q)) return 0.4;

      return 0;
    };

    tools.push({
      name: "crm_search",
      description: "Search CRM contacts by name, alias, tag, or keyword. Supports fuzzy matching for speech-to-text name mangling. Returns contact details.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, alias, tag, or keyword to search for" },
        },
        required: ["query"],
      },
      async handler(params) {
        try {
          const { query } = params as { query: string };
          const { existsSync, readdirSync, readFileSync } = await import("fs");
          if (!existsSync(crmDir)) {
            return { content: [{ type: "text", text: "CRM directory not found" }] };
          }
          const files = readdirSync(crmDir).filter(f => f.endsWith(".md"));
          const scored: Array<{ contact: CrmContact; score: number }> = [];
          for (const file of files) {
            try {
              const content = readFileSync(join(crmDir, file), "utf8");
              const contact = parseCrmFileForSearch(file.replace(/\.md$/, ""), content);
              const score = fuzzyMatchScore(query, contact);
              if (score > 0) scored.push({ contact, score });
            } catch { /* skip */ }
          }
          scored.sort((a, b) => b.score - a.score);
          const results = scored.slice(0, 5);
          if (results.length === 0) {
            return { content: [{ type: "text", text: `No CRM contacts found matching "${query}"` }] };
          }
          const formatted = results.map(({ contact: c, score }) => {
            const lines = [`**${c.name}** (match: ${(score * 100).toFixed(0)}%)`];
            if (c.phone) lines.push(`Phone: ${c.phone}`);
            if (c.email) lines.push(`Email: ${c.email}`);
            if (c.tags.length) lines.push(`Tags: ${c.tags.join(", ")}`);
            if (c.context) lines.push(`Context: ${c.context}`);
            if (c.connections.length) {
              lines.push(`Connections: ${c.connections.map(cn => `${cn.name} (${cn.relationship})`).join(", ")}`);
            }
            if (c.aliases.length) lines.push(`Aliases: ${c.aliases.join(", ")}`);
            if (c.notes) lines.push(`Notes: ${c.notes.slice(0, 300)}`);
            return lines.join("\n");
          }).join("\n\n---\n\n");
          return { content: [{ type: "text", text: formatted }] };
        } catch (err) {
          return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
        }
      },
    });
  }

  // --- Calendar Today (Zoho Calendar wrapper) ---
  // Defined before zoho_fetch since it uses the same token refresh infrastructure

  // --- Zoho API with auto-refresh ---

  const zohoRefresh = async (tokenFile: string): Promise<string> => {
    const { readFileSync, writeFileSync } = await import("fs");
    const tokens = JSON.parse(readFileSync(tokenFile, "utf-8"));
    const now = Date.now() / 1000;
    // Refresh if token is expired or will expire within 5 minutes
    if (tokens.access_token && tokens.created_at && (now - tokens.created_at) < (tokens.expires_in - 300)) {
      return tokens.access_token;
    }
    // Refresh the token
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: tokens.client_id,
      client_secret: tokens.client_secret,
      refresh_token: tokens.refresh_token,
    });
    const resp = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params}`, { method: "POST" });
    if (!resp.ok) throw new Error(`Zoho refresh failed ${resp.status}: ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number; token_type: string; error?: string };
    if (data.error) throw new Error(`Zoho refresh error: ${data.error}`);
    tokens.access_token = data.access_token;
    tokens.expires_in = data.expires_in;
    tokens.created_at = Date.now() / 1000;
    writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
    return data.access_token;
  };

  tools.push({
    name: "zoho_fetch",
    description: "Make an authenticated Zoho API call with automatic token refresh. Supports Mail, Calendar, and other Zoho APIs.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full Zoho API URL (e.g. https://mail.zoho.com/api/accounts/...)" },
        method: { type: "string", description: "HTTP method (default GET)" },
        body: { type: "string", description: "Request body (JSON string)" },
        tokenFile: { type: "string", description: "Token file: 'hal' for zoho-mail-tokens.json (default), 'caul' for zoho-caul-tokens.json" },
        contentType: { type: "string", description: "Content-Type header (default application/json)" },
      },
      required: ["url"],
    },
    async handler(params) {
      try {
        const { url, method = "GET", body, tokenFile = "hal", contentType = "application/json" } = params as {
          url: string; method?: string; body?: string; tokenFile?: string; contentType?: string;
        };
        const homedir = (await import("os")).homedir();
        const file = tokenFile === "caul"
          ? `${homedir}/.homaruscc/secrets/zoho-caul-tokens.json`
          : `${homedir}/.homaruscc/secrets/zoho-mail-tokens.json`;
        const accessToken = await zohoRefresh(file);
        const fetchOpts: RequestInit = {
          method,
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": contentType,
          },
        };
        if (body) fetchOpts.body = body;
        const resp = await fetch(url, fetchOpts);
        const text = await resp.text();
        if (!resp.ok) return { content: [{ type: "text", text: `Zoho API ${resp.status}: ${text}` }] };
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // --- calendar_today (wraps Zoho Calendar API) ---
  tools.push({
    name: "calendar_today",
    description: "Get today's calendar events. Optionally pass a date string (YYYY-MM-DD) to check a different day.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date to check (YYYY-MM-DD). Defaults to today." },
      },
    },
    async handler(params) {
      try {
        const { date } = params as { date?: string };
        const targetDate = date || new Date().toISOString().slice(0, 10);
        const calendarUid = "8039ad13d9c54a35b9687fef031585bf";
        const home = homedir();
        const tokenFilePath = `${home}/.homaruscc/secrets/zoho-mail-tokens.json`;
        const accessToken = await zohoRefresh(tokenFilePath);

        // Zoho Calendar API: range query for the target date
        // Format: yyyyMMdd'T'HHmmssZ
        const startRange = `${targetDate.replace(/-/g, "")}T000000Z`;
        const endRange = `${targetDate.replace(/-/g, "")}T235959Z`;

        const url = `https://calendar.zoho.com/api/v1/calendars/${calendarUid}/events?range=${JSON.stringify({ start: startRange, end: endRange })}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });

        if (!resp.ok) {
          // Fallback: try listing events without range filter
          const fallbackUrl = `https://calendar.zoho.com/api/v1/calendars/${calendarUid}/events`;
          const fallbackResp = await fetch(fallbackUrl, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (!fallbackResp.ok) {
            return { content: [{ type: "text", text: `Zoho Calendar API ${fallbackResp.status}: ${await fallbackResp.text()}` }] };
          }
          const allData = await fallbackResp.json() as { events?: Array<{ title: string; dateandtime?: { start: string; end: string }; location?: string }> };
          const events = (allData.events || []).filter((e: { dateandtime?: { start: string } }) => {
            if (!e.dateandtime?.start) return false;
            return e.dateandtime.start.includes(targetDate.replace(/-/g, ""));
          });
          if (events.length === 0) {
            return { content: [{ type: "text", text: `No events found for ${targetDate}` }] };
          }
          const formatted = events.map((e: { title: string; dateandtime?: { start: string; end: string }; location?: string }) => {
            const parts = [e.title];
            if (e.dateandtime) parts.push(`${e.dateandtime.start} - ${e.dateandtime.end}`);
            if (e.location) parts.push(`Location: ${e.location}`);
            return parts.join(" | ");
          }).join("\n");
          return { content: [{ type: "text", text: `Events for ${targetDate}:\n${formatted}` }] };
        }

        const data = await resp.json() as { events?: Array<{ title: string; dateandtime?: { start: string; end: string }; location?: string }> };
        const events = data.events || [];
        if (events.length === 0) {
          return { content: [{ type: "text", text: `No events found for ${targetDate}` }] };
        }
        const formatted = events.map((e: { title: string; dateandtime?: { start: string; end: string }; location?: string }) => {
          const parts = [e.title];
          if (e.dateandtime) parts.push(`${e.dateandtime.start} - ${e.dateandtime.end}`);
          if (e.location) parts.push(`Location: ${e.location}`);
          return parts.join(" | ");
        }).join("\n");
        return { content: [{ type: "text", text: `Events for ${targetDate}:\n${formatted}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  // Record collection and other plugin tools are merged by DashboardServer.start()

  // --- run_tool ---
  tools.push({
    name: "run_tool",
    description: "Execute any registered tool (bash, read, write, edit, glob, grep, git, web_fetch, web_search, memory_*)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name to execute" },
        params: { type: "object", description: "Tool parameters" },
      },
      required: ["name", "params"],
    },
    async handler(params) {
      const { name, params: toolParams } = params as { name: string; params: Record<string, unknown> };
      const context = {
        agentId: "claude-code",
        sandbox: false,
        workingDir: process.cwd(),
      };
      const result = await loop.getToolRegistry().execute(name, toolParams, context);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}\n${result.output}` }] };
      }
      return { content: [{ type: "text", text: result.output }] };
    },
  });

  // --- Session transcript extraction ---
  tools.push({
    name: "session_extract",
    description: "Extract insights from recent Claude Code session transcripts (JSONL logs). Reads session files, summarizes them, and uses Haiku to extract decisions, patterns, debugging solutions, and architecture insights. Stores results in memory. Run during daily reflection.",
    inputSchema: {
      type: "object",
      properties: {
        hours_back: { type: "number", description: "How many hours back to look for transcripts (default 24)" },
      },
    },
    async handler(params) {
      const extractor = loop.getSessionExtractor();
      if (!extractor) {
        return { content: [{ type: "text", text: "SessionExtractor not initialized" }] };
      }
      const { hours_back } = params as { hours_back?: number };
      const result = await extractor.extractRecent(hours_back ?? 24);
      return {
        content: [{
          type: "text",
          text: `Session extraction complete: processed ${result.processed} transcripts, stored ${result.insights} insights`,
        }],
      };
    },
  });

  // --- Obsidian CLI tools ---
  const obsidian = new ObsidianCLI();
  const NOT_AVAILABLE = "Obsidian CLI is not available — Obsidian may not be running";

  tools.push({
    name: "obsidian_eval",
    description: "Execute JavaScript against the Obsidian API (requires Obsidian running with CLI enabled)",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to evaluate against the Obsidian API" },
      },
      required: ["code"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const result = await obsidian.eval((params as { code: string }).code);
        return { content: [{ type: "text", text: result || "(no output)" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_move",
    description: "Move or rename a file in the vault, automatically updating all wikilinks",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Source file path (relative to vault root)" },
        to: { type: "string", description: "Destination file path (relative to vault root)" },
      },
      required: ["file", "to"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const { file, to } = params as { file: string; to: string };
        await obsidian.move(file, to);
        return { content: [{ type: "text", text: `Moved ${file} → ${to}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_tags_rename",
    description: "Bulk rename a tag across all files in the vault",
    inputSchema: {
      type: "object",
      properties: {
        oldTag: { type: "string", description: "Tag to rename (e.g. 'project/old-name')" },
        newTag: { type: "string", description: "New tag name (e.g. 'project/new-name')" },
      },
      required: ["oldTag", "newTag"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const { oldTag, newTag } = params as { oldTag: string; newTag: string };
        await obsidian.tagsRename(oldTag, newTag);
        return { content: [{ type: "text", text: `Renamed tag ${oldTag} → ${newTag}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_backlinks",
    description: "Get all files that link to a given note",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path to find backlinks for (relative to vault root)" },
      },
      required: ["file"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const links = await obsidian.backlinks((params as { file: string }).file);
        return { content: [{ type: "text", text: links.length ? links.join("\n") : "No backlinks found" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_orphans",
    description: "Find notes with no backlinks (orphan notes)",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const orphans = await obsidian.orphans();
        return { content: [{ type: "text", text: orphans.length ? orphans.join("\n") : "No orphan notes found" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_search",
    description: "Search the vault using Obsidian's built-in search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (Obsidian search syntax)" },
      },
      required: ["query"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const results = await obsidian.search((params as { query: string }).query);
        return { content: [{ type: "text", text: results.length ? JSON.stringify(results, null, 2) : "No results" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_tags",
    description: "List all tags used in the vault",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const tags = await obsidian.tags();
        return { content: [{ type: "text", text: tags.length ? tags.join("\n") : "No tags found" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_unresolved",
    description: "Find broken/unresolved wikilinks in the vault",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const unresolved = await obsidian.unresolved();
        return { content: [{ type: "text", text: unresolved.length ? unresolved.join("\n") : "No unresolved links" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_properties",
    description: "Read frontmatter properties from a note",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path (relative to vault root)" },
      },
      required: ["file"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const props = await obsidian.properties((params as { file: string }).file);
        return { content: [{ type: "text", text: JSON.stringify(props, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });

  tools.push({
    name: "obsidian_property_set",
    description: "Set a frontmatter property on a note",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path (relative to vault root)" },
        key: { type: "string", description: "Property key to set" },
        value: { type: "string", description: "Property value to set" },
      },
      required: ["file", "key", "value"],
    },
    async handler(params) {
      if (!(await obsidian.isAvailable())) return { content: [{ type: "text", text: NOT_AVAILABLE }] };
      try {
        const { file, key, value } = params as { file: string; key: string; value: string };
        await obsidian.propertySet(file, key, value);
        return { content: [{ type: "text", text: `Set ${key} on ${file}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    },
  });


  // Append any tools registered by optional extensions (see
  // HomarUScc.registerExtraMcpTool). Fresh clones of the public repo have
  // none — this is how gitignored modules like personal-extensions.ts
  // contribute their own MCP tool surface.
  const combined = [...tools, ...loop.getExtraMcpTools()];

  // ACC pre-send hook support: every tool call is recorded so the
  // outbound-text detector can reason about whether verification
  // happened before an assertion. telegram_send/dashboard_send are
  // deliberately NOT recorded as "verification" — see VERIFY_TOOL /
  // VERIFY_BASH regexes in conflict-monitor.ts.
  const recordingSkip = new Set<string>(["telegram_send", "dashboard_send", "acc_log_missed"]);
  for (const tool of combined) {
    const original = tool.handler;
    tool.handler = async (params: Record<string, unknown>) => {
      const result = await original(params);
      if (!recordingSkip.has(tool.name)) {
        try {
          const summary = typeof params === "object" && params
            ? JSON.stringify(params).slice(0, 300)
            : String(params ?? "");
          loop.getConflictMonitor().recordToolCall(tool.name, summary);
        } catch {
          // non-critical
        }
      }
      return result;
    };
  }
  return combined;
}
