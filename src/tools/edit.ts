// Built-in tool: edit — from HomarUS
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

interface EditParams {
  path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export const editTool: ToolDefinition = {
  name: "edit",
  description: "Perform an exact string replacement in a file.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative path to the file" },
      old_string: { type: "string", description: "The exact text to find and replace" },
      new_string: { type: "string", description: "The replacement text" },
      replace_all: { type: "boolean", description: "Replace all occurrences (default false)" },
    },
    required: ["path", "old_string", "new_string"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path: filePath, old_string, new_string, replace_all = false } = params as EditParams;
    const absPath = resolve(context.workingDir, filePath);

    if (context.sandbox) {
      return { output: "", error: "edit tool is not available in sandbox mode" };
    }

    if (!existsSync(absPath)) {
      return { output: "", error: `File not found: ${absPath}` };
    }

    const content = readFileSync(absPath, "utf-8");

    if (!content.includes(old_string)) {
      return { output: "", error: "old_string not found in file" };
    }

    if (!replace_all) {
      const firstIdx = content.indexOf(old_string);
      const secondIdx = content.indexOf(old_string, firstIdx + 1);
      if (secondIdx !== -1) {
        return { output: "", error: "old_string is not unique in the file. Provide more context or use replace_all." };
      }
    }

    const updated = replace_all
      ? content.split(old_string).join(new_string)
      : content.replace(old_string, new_string);

    writeFileSync(absPath, updated);

    const count = replace_all ? content.split(old_string).length - 1 : 1;
    return { output: `Replaced ${count} occurrence(s) in ${absPath}` };
  },
};
