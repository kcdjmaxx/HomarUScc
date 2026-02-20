// CRC: crc-ToolRegistry.md
// Built-in tool: web_fetch — from HomarUS
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

const MAX_RESPONSE = 100_000;

interface WebFetchParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description: "Fetch content from a URL. Returns the response body as text.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      method: { type: "string", description: "HTTP method (default GET)", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
      headers: { type: "object", description: "Optional request headers" },
      body: { type: "string", description: "Optional request body" },
    },
    required: ["url"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { url, method = "GET", headers, body } = params as WebFetchParams;

    if (context.sandbox) {
      return { output: "", error: "web_fetch tool is not available in sandbox mode" };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: headers ? new Headers(headers) : undefined,
        body: body ?? undefined,
        signal: AbortSignal.timeout(30_000),
      });

      const contentType = response.headers.get("content-type") ?? "";
      let text: string;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await response.text();
      }

      if (text.length > MAX_RESPONSE) {
        text = text.slice(0, MAX_RESPONSE) + `\n... (truncated, ${text.length} total chars)`;
      }

      const statusLine = `HTTP ${response.status} ${response.statusText}`;

      if (!response.ok) {
        return { output: text, error: statusLine };
      }

      return { output: `${statusLine}\n\n${text}` };
    } catch (err) {
      return { output: "", error: `Fetch failed: ${String((err as Error).message ?? err)}` };
    }
  },
};
