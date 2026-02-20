// Built-in tool: write — from HomarUS
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

interface WriteParams {
  path: string;
  content: string;
}

export const writeTool: ToolDefinition = {
  name: "write",
  description: "Write content to a file, creating it if it doesn't exist.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative path to the file" },
      content: { type: "string", description: "The content to write" },
    },
    required: ["path", "content"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path: filePath, content } = params as WriteParams;
    const absPath = resolve(context.workingDir, filePath);

    if (context.sandbox) {
      return { output: "", error: "write tool is not available in sandbox mode" };
    }

    const dir = dirname(absPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(absPath, content);
    const lines = content.split("\n").length;
    return { output: `Wrote ${lines} lines to ${absPath}` };
  },
};
