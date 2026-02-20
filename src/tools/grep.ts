// CRC: crc-ToolRegistry.md
// Built-in tool: grep — from HomarUS
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

const MAX_MATCHES = 200;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface GrepParams {
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  context?: number;
  case_insensitive?: boolean;
  limit?: number;
}

const TYPE_EXTENSIONS: Record<string, string[]> = {
  js: [".js", ".mjs", ".cjs"],
  ts: [".ts", ".tsx", ".mts"],
  py: [".py", ".pyi"],
  rust: [".rs"],
  go: [".go"],
  java: [".java"],
  md: [".md"],
  json: [".json"],
  yaml: [".yaml", ".yml"],
  html: [".html", ".htm"],
  css: [".css", ".scss"],
  sh: [".sh", ".bash", ".zsh"],
};

function matchesGlob(filename: string, glob: string): boolean {
  const regex = glob
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");
  return new RegExp(regex + "$").test(filename);
}

function walkFiles(dir: string, filterFn: (path: string) => boolean, results: string[], depth = 0): void {
  if (depth > 20) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, filterFn, results, depth + 1);
    } else if (entry.isFile() && filterFn(fullPath)) {
      results.push(fullPath);
    }
  }
}

export const grepTool: ToolDefinition = {
  name: "grep",
  description: "Search file contents using regex. Supports file type filtering, context lines, and multiple output modes.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: { type: "string", description: "File or directory to search in" },
      glob: { type: "string", description: "Glob to filter files" },
      type: { type: "string", description: "File type filter (js, ts, py, etc.)" },
      output_mode: { type: "string", description: "Output mode: content, files_with_matches, count", enum: ["content", "files_with_matches", "count"] },
      context: { type: "number", description: "Context lines before and after each match" },
      case_insensitive: { type: "boolean", description: "Case insensitive search" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    required: ["pattern"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const {
      pattern: rawPattern, path: searchPath, glob: globFilter, type: typeFilter,
      output_mode = "files_with_matches", context: ctxLines = 0,
      case_insensitive = false, limit,
    } = params as GrepParams;

    const rootPath = searchPath ? resolve(context.workingDir, searchPath) : context.workingDir;

    if (!existsSync(rootPath)) {
      return { output: "", error: `Path not found: ${rootPath}` };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(rawPattern, case_insensitive ? "gi" : "g");
    } catch (err) {
      return { output: "", error: `Invalid regex: ${String(err)}` };
    }

    const typeExts = typeFilter ? TYPE_EXTENSIONS[typeFilter] : null;
    const filterFn = (filePath: string): boolean => {
      if (typeExts && !typeExts.includes(extname(filePath))) return false;
      if (globFilter && !matchesGlob(filePath, globFilter)) return false;
      return true;
    };

    const files: string[] = [];
    const stat = statSync(rootPath);
    if (stat.isFile()) {
      files.push(rootPath);
    } else {
      walkFiles(rootPath, filterFn, files);
    }

    const maxResults = limit ?? MAX_MATCHES;
    let totalMatches = 0;
    const outputParts: string[] = [];
    const matchingFiles: string[] = [];
    const fileCounts: Array<{ file: string; count: number }> = [];

    for (const file of files) {
      if (totalMatches >= maxResults) break;

      let content: string;
      try {
        const fstat = statSync(file);
        if (fstat.size > MAX_FILE_SIZE) continue;
        content = readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      const matchedLineNums: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          matchedLineNums.push(i);
        }
      }

      if (matchedLineNums.length === 0) continue;

      matchingFiles.push(file);
      fileCounts.push({ file, count: matchedLineNums.length });

      if (output_mode === "content") {
        for (const lineNum of matchedLineNums) {
          if (totalMatches >= maxResults) break;
          totalMatches++;

          const startCtx = Math.max(0, lineNum - ctxLines);
          const endCtx = Math.min(lines.length - 1, lineNum + ctxLines);

          if (ctxLines > 0) {
            outputParts.push(`${file}:`);
            for (let i = startCtx; i <= endCtx; i++) {
              const prefix = i === lineNum ? ">" : " ";
              outputParts.push(`${prefix}${i + 1}:${lines[i]}`);
            }
            outputParts.push("--");
          } else {
            outputParts.push(`${file}:${lineNum + 1}:${lines[lineNum]}`);
          }
        }
      } else {
        totalMatches += matchedLineNums.length;
      }
    }

    switch (output_mode) {
      case "content":
        return { output: outputParts.length > 0 ? outputParts.join("\n") : "No matches found" };
      case "files_with_matches":
        return { output: matchingFiles.length > 0 ? matchingFiles.join("\n") : "No matches found" };
      case "count":
        return {
          output: fileCounts.length > 0
            ? fileCounts.map((f) => `${f.file}: ${f.count}`).join("\n")
            : "No matches found",
        };
      default:
        return { output: matchingFiles.join("\n") };
    }
  },
};
