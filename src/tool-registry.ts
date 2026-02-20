// CRC: crc-ToolRegistry.md | Seq: seq-event-flow.md
// Tool registry with policies — from HomarUS
import type { ToolDefinition, ToolResult, ToolContext, Logger } from "./types.js";

export interface ToolPolicy {
  name: string;
  allow?: string[];
  deny?: string[];
}

const BUILTIN_GROUPS: Record<string, string[]> = {
  "group:fs": ["read", "write", "edit", "glob", "grep"],
  "group:runtime": ["bash", "git"],
  "group:web": ["web_fetch", "web_search", "browser"],
  "group:code": ["lsp"],
  "group:memory": ["memory_search", "memory_get", "memory_store"],
};

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private policies: ToolPolicy[] = [];
  private groups = new Map<string, string[]>(Object.entries(BUILTIN_GROUPS));
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.logger.debug("Registered tool", { name: tool.name, source: tool.source });
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  getForAgent(allowedTools?: string[]): ToolDefinition[] {
    const all = this.getAll();
    if (!allowedTools) return all;

    const resolved = new Set<string>();
    for (const name of allowedTools) {
      const group = this.groups.get(name);
      if (group) {
        group.forEach((t) => resolved.add(t));
      } else {
        resolved.add(name);
      }
    }

    return all.filter((t) => resolved.has(t.name));
  }

  async execute(name: string, params: unknown, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: "", error: `Unknown tool: ${name}` };
    }

    if (!this.checkPolicy(name, context)) {
      return { output: "", error: `Tool ${name} denied by policy` };
    }

    if (params == null || typeof params !== "object" || Array.isArray(params)) {
      return { output: "", error: `Tool ${name} requires an object parameter, got ${typeof params}` };
    }

    const start = Date.now();
    try {
      const result = await tool.execute(params, context);
      this.logger.debug("Tool executed", { name, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      this.logger.error("Tool execution failed", { name, error: String(err) });
      return { output: "", error: String(err) };
    }
  }

  registerGroup(name: string, toolNames: string[]): void {
    this.groups.set(name, toolNames);
  }

  resolveGroup(groupName: string): string[] {
    return this.groups.get(groupName) ?? [];
  }

  addPolicy(policy: ToolPolicy): void {
    this.policies.push(policy);
  }

  checkPolicy(toolName: string, _context: ToolContext): boolean {
    for (const policy of this.policies) {
      const denied = this.resolveNames(policy.deny ?? []);
      if (denied.has(toolName)) return false;
      if (policy.allow) {
        const allowed = this.resolveNames(policy.allow);
        if (!allowed.has(toolName)) return false;
      }
    }
    return true;
  }

  private resolveNames(names: string[]): Set<string> {
    const resolved = new Set<string>();
    for (const name of names) {
      const group = this.groups.get(name);
      if (group) group.forEach((t) => resolved.add(t));
      else resolved.add(name);
    }
    return resolved;
  }

  toSchemas(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }
}
