// CRC: crc-McpServer.md | Seq: seq-event-flow.md, seq-memory-search.md, seq-browser-action.md
// MCP tool definitions exposed to Claude Code
import type { HomarUScc } from "./homaruscc.js";
import type { TelegramChannelAdapter } from "./telegram-adapter.js";
import type { DashboardAdapter } from "./dashboard-adapter.js";

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
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
      try {
        await loop.getChannelManager().send("telegram", chatId, { text });
        loop.getTranscriptLogger()?.logOutbound("telegram", text);
        return { content: [{ type: "text", text: `Sent to Telegram chat ${chatId}` }] };
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
    description: "Search the memory index using hybrid vector + FTS search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
    async handler(params) {
      const { query, limit = 10 } = params as { query: string; limit?: number };
      const results = await loop.getMemoryIndex().search(query, { limit });
      if (results.length === 0) {
        return { content: [{ type: "text", text: "No results found" }] };
      }
      const formatted = results.map((r, i) =>
        `[${i + 1}] ${r.path} (score: ${r.score.toFixed(3)})\n${r.content.slice(0, 500)}`
      ).join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
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
      await loop.getMemoryIndex().store(content, key);
      return { content: [{ type: "text", text: `Stored and indexed: ${key}` }] };
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
      try {
        await loop.getChannelManager().send("dashboard", "chat", { text });
        loop.getTranscriptLogger()?.logOutbound("dashboard", text);
        return { content: [{ type: "text", text: "Sent to dashboard" }] };
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
        bucketId: { type: "string", description: "Bucket ID (e.g., bucket-fric-and-frac)" },
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

  return tools;
}
