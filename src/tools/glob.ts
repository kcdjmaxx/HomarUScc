// Built-in tool: glob — from HomarUS
import { resolve } from "node:path";
import { readdirSync, statSync, existsSync } from "node:fs";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

const MAX_RESULTS = 500;

interface GlobParams {
  pattern: string;
  path?: string;
}

function minimatch(filePath: string, pattern: string): boolean {
  let regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "\u2B50\u2B50")
    .replace(/\*/g, "[^/]*")
    .replace(/\u2B50\u2B50/g, ".*")
    .replace(/\?/g, "[^/]");
  if (!regex.startsWith(".*") && !regex.startsWith("/")) {
    regex = "(^|/)" + regex;
  }
  return new RegExp(regex + "$").test(filePath);
}

function walkDir(dir: string, pattern: string, results: string[], maxDepth = 20, depth = 0): void {
  if (depth > maxDepth || results.length >= MAX_RESULTS) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) return;
    if (entry.name.startsWith(".") && !pattern.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, pattern, results, maxDepth, depth + 1);
    } else if (entry.isFile()) {
      if (minimatch(fullPath, pattern) || minimatch(entry.name, pattern)) {
        results.push(fullPath);
      }
    }
  }
}

export const globTool: ToolDefinition = {
  name: "glob",
  description: "Find files matching a glob pattern. Supports **, *, ?. Excludes node_modules and .git.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern to match files" },
      path: { type: "string", description: "Directory to search in (default: working directory)" },
    },
    required: ["pattern"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { pattern, path: searchPath } = params as GlobParams;
    const rootDir = searchPath ? resolve(context.workingDir, searchPath) : context.workingDir;

    if (!existsSync(rootDir)) {
      return { output: "", error: `Directory not found: ${rootDir}` };
    }

    const results: string[] = [];
    walkDir(rootDir, pattern, results);

    results.sort((a, b) => {
      try {
        return statSync(b).mtimeMs - statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });

    if (results.length === 0) {
      return { output: "No files found" };
    }

    let output = results.join("\n");
    if (results.length >= MAX_RESULTS) {
      output += `\n... (truncated at ${MAX_RESULTS} results)`;
    }

    return { output };
  },
};
