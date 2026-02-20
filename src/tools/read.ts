// Built-in tool: read — from HomarUS
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LINES = 2000;

interface ReadParams {
  path: string;
  offset?: number;
  limit?: number;
}

export const readTool: ToolDefinition = {
  name: "read",
  description: "Read the contents of a file. Returns numbered lines.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative path to the file" },
      offset: { type: "number", description: "Line number to start reading from (1-based)" },
      limit: { type: "number", description: "Maximum number of lines to return" },
    },
    required: ["path"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path: filePath, offset, limit } = params as ReadParams;
    const absPath = resolve(context.workingDir, filePath);

    if (!existsSync(absPath)) {
      return { output: "", error: `File not found: ${absPath}` };
    }

    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      return { output: "", error: `Path is a directory: ${absPath}` };
    }
    if (stat.size > MAX_FILE_SIZE) {
      return { output: "", error: `File too large (${stat.size} bytes). Max: ${MAX_FILE_SIZE}` };
    }

    const content = readFileSync(absPath, "utf-8");
    const allLines = content.split("\n");

    const startLine = (offset ?? 1) - 1;
    const maxLines = limit ?? MAX_LINES;
    const lines = allLines.slice(startLine, startLine + maxLines);

    const numbered = lines.map((line, i) => {
      const lineNum = startLine + i + 1;
      const truncated = line.length > 2000 ? line.slice(0, 2000) + "..." : line;
      return `${String(lineNum).padStart(6)}\t${truncated}`;
    });

    let output = numbered.join("\n");
    if (startLine + maxLines < allLines.length) {
      output += `\n... (${allLines.length - startLine - maxLines} more lines)`;
    }

    return { output };
  },
};
