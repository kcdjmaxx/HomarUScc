// CRC: crc-MemoryIndex.md
// Built-in tools: memory_search, memory_get, memory_store — from HomarUS
import type { ToolDefinition, ToolResult } from "../types.js";
import type { MemoryIndex } from "../memory-index.js";

interface SearchParams {
  query: string;
  limit?: number;
}

interface GetParams {
  path: string;
}

interface StoreParams {
  content: string;
  path: string;
}

export function createMemoryTools(memoryIndex: MemoryIndex): ToolDefinition[] {
  const memorySearchTool: ToolDefinition = {
    name: "memory_search",
    description: "Search the memory index using hybrid vector + text search.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        limit: { type: "number", description: "Maximum number of results (default 10)" },
      },
      required: ["query"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { query, limit } = params as SearchParams;
      const results = await memoryIndex.search(query, { limit });

      if (results.length === 0) {
        return { output: "No results found." };
      }

      const formatted = results.map((r, i) =>
        `[${i + 1}] ${r.path} (score: ${r.score.toFixed(3)})\n${r.content.slice(0, 500)}`
      ).join("\n\n---\n\n");

      return { output: formatted };
    },
  };

  const memoryGetTool: ToolDefinition = {
    name: "memory_get",
    description: "Retrieve the full content of a specific file from memory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to retrieve" },
      },
      required: ["path"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { path } = params as GetParams;
      const content = memoryIndex.get(path);
      if (!content) {
        return { output: "", error: `File not found: ${path}` };
      }
      return { output: content };
    },
  };

  const memoryStoreTool: ToolDefinition = {
    name: "memory_store",
    description: "Store content to a file in memory and index it for future search.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The content to store" },
        path: { type: "string", description: "The file path to store at" },
      },
      required: ["content", "path"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { content, path } = params as StoreParams;
      await memoryIndex.store(content, path);
      return { output: `Stored and indexed: ${path}` };
    },
  };

  return [memorySearchTool, memoryGetTool, memoryStoreTool];
}
