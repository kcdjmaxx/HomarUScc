// Built-in tool: bash — from HomarUS
import { exec } from "node:child_process";
import type { ToolDefinition, ToolContext, ToolResult } from "../types.js";

const MAX_OUTPUT = 50_000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive).*\//, label: "rm -rf /" },
  { pattern: /\bsudo\b/, label: "sudo" },
  { pattern: /\bmkfs\b/, label: "mkfs" },
  { pattern: /\bdd\s+.*of=\/dev\//, label: "dd to device" },
  { pattern: />\s*\/dev\/sd/, label: "redirect to disk device" },
  { pattern: /\bchmod\s+777\b/, label: "chmod 777" },
  { pattern: /\bcurl\b.*\|\s*(ba)?sh/, label: "curl pipe to shell" },
  { pattern: /\bwget\b.*\|\s*(ba)?sh/, label: "wget pipe to shell" },
  { pattern: /\b(shutdown|reboot|halt|poweroff)\b/, label: "system control" },
  { pattern: /\bkillall\b/, label: "killall" },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, label: "fork bomb" },
];

interface BashParams {
  command: string;
  timeout?: number;
  workingDir?: string;
}

export const bashTool: ToolDefinition = {
  name: "bash",
  description: "Execute a bash command and return stdout/stderr.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The bash command to execute" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 120000)" },
      workingDir: { type: "string", description: "Working directory for the command" },
    },
    required: ["command"],
  },
  source: "builtin",

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { command, timeout = 120_000, workingDir } = params as BashParams;

    for (const { pattern, label } of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return { output: "", error: `Blocked: command matches dangerous pattern (${label}).` };
      }
    }

    if (context.sandbox) {
      return { output: "", error: "bash tool is not available in sandbox mode" };
    }

    return new Promise((resolve) => {
      exec(command, {
        cwd: workingDir ?? context.workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, TERM: "dumb" },
      }, (error, stdout, stderr) => {
        let output = stdout;
        if (stderr) output += (output ? "\n" : "") + stderr;

        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + `\n... (truncated, ${output.length} total chars)`;
        }

        if (error && error.killed) {
          resolve({ output, error: `Command timed out after ${timeout}ms` });
        } else if (error) {
          resolve({ output, error: `Exit code ${error.code}: ${error.message}` });
        } else {
          resolve({ output });
        }
      });
    });
  },
};
