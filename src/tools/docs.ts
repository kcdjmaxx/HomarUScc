// MCP tools for domain-specific documentation vector DB
// Tools: docs_search, docs_ingest, docs_list, docs_clear
import type { ToolDefinition, ToolResult } from "../types.js";
import type { DocsIndex } from "../docs-index.js";

interface DocsSearchParams {
  domain: string;
  query: string;
  limit?: number;
}

interface DocsIngestParams {
  domain: string;
  path: string;
}

interface DocsIngestTextParams {
  domain: string;
  key: string;
  content: string;
}

interface DocsClearParams {
  domain: string;
}

export function createDocsTools(docsIndex: DocsIndex): ToolDefinition[] {
  const docsSearchTool: ToolDefinition = {
    name: "docs_search",
    description: "Search a domain-specific documentation index. Each domain has its own vector DB (e.g., 'touchdesigner', 'openclaw'). Use docs_list to see available domains.",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner', 'openclaw'). Use '*' to search all domains." },
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["domain", "query"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { domain, query, limit } = params as DocsSearchParams;

      const results = domain === "*"
        ? await docsIndex.searchAll(query, limit)
        : await docsIndex.search(domain, query, limit);

      if (results.length === 0) {
        return { output: `No results found in domain "${domain}".` };
      }

      const formatted = results.map((r, i) =>
        `[${i + 1}] [${r.domain}] ${r.path} (score: ${r.score.toFixed(3)})\n${r.content.slice(0, 500)}`
      ).join("\n\n---\n\n");

      return { output: formatted };
    },
  };

  const docsIngestTool: ToolDefinition = {
    name: "docs_ingest",
    description: "Ingest files into a domain-specific documentation index. Accepts a file path or directory. Supports .md, .txt, .html, .json, .yaml, .yml, .rst, .xml files.",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner')" },
        path: { type: "string", description: "File or directory path to ingest" },
      },
      required: ["domain", "path"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { domain, path } = params as DocsIngestParams;

      try {
        const result = await docsIndex.ingest(domain, path);
        return {
          output: `Ingested into "${domain}": ${result.filesProcessed} files, ${result.chunksCreated} chunks`,
        };
      } catch (err) {
        return { output: "", error: `Ingest failed: ${String(err)}` };
      }
    },
  };

  const docsIngestTextTool: ToolDefinition = {
    name: "docs_ingest_text",
    description: "Ingest raw text content into a domain documentation index. Useful for adding scraped web pages, API responses, or generated content without saving to disk first.",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name (e.g., 'touchdesigner')" },
        key: { type: "string", description: "A unique key/path for this content (e.g., 'api/operators/moviefilein')" },
        content: { type: "string", description: "The text content to index" },
      },
      required: ["domain", "key", "content"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { domain, key, content } = params as DocsIngestTextParams;

      try {
        const result = await docsIndex.ingestText(domain, key, content);
        return {
          output: `Ingested into "${domain}" as "${key}": ${result.chunksCreated} chunks`,
        };
      } catch (err) {
        return { output: "", error: `Ingest failed: ${String(err)}` };
      }
    },
  };

  const docsListTool: ToolDefinition = {
    name: "docs_list",
    description: "List all available documentation domains and their stats.",
    parameters: {
      type: "object",
      properties: {},
    },
    source: "builtin",

    async execute(): Promise<ToolResult> {
      const domains = docsIndex.listDomains();

      if (domains.length === 0) {
        return { output: "No documentation domains indexed yet. Use docs_ingest to add one." };
      }

      const formatted = domains.map((d) =>
        `${d.domain}: ${d.stats.fileCount} files, ${d.stats.chunkCount} chunks`
      ).join("\n");

      return { output: formatted };
    },
  };

  const docsClearTool: ToolDefinition = {
    name: "docs_clear",
    description: "Clear a documentation domain, removing all indexed content.",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name to clear" },
      },
      required: ["domain"],
    },
    source: "builtin",

    async execute(params: unknown): Promise<ToolResult> {
      const { domain } = params as DocsClearParams;
      await docsIndex.clearDomain(domain);
      return { output: `Domain "${domain}" cleared.` };
    },
  };

  return [docsSearchTool, docsIngestTool, docsIngestTextTool, docsListTool, docsClearTool];
}
