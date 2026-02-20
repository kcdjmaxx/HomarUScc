// Skill manager — from HomarUS
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { watch, type FSWatcher } from "node:fs";
import type { Event, SkillManifest, ToolSchema, Logger } from "./types.js";
import { Skill } from "./skill.js";
import {
  HttpSkillTransport, StdioSkillTransport, DirectSkillTransport,
} from "./skill-transport.js";
import type { EventBus } from "./event-bus.js";
import type { ToolRegistry } from "./tool-registry.js";

export class SkillManager {
  private skills = new Map<string, Skill>();
  private searchPaths: string[];
  private watcher: FSWatcher | null = null;
  private logger: Logger;
  private eventBus: EventBus;
  private toolRegistry: ToolRegistry;
  private loopEmitter: ((event: Event) => void) | null = null;

  constructor(
    logger: Logger,
    eventBus: EventBus,
    toolRegistry: ToolRegistry,
    searchPaths: string[] = [],
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.toolRegistry = toolRegistry;
    this.searchPaths = searchPaths;
  }

  setLoopEmitter(fn: (event: Event) => void): void {
    this.loopEmitter = fn;
  }

  async loadAll(): Promise<void> {
    for (const searchPath of this.searchPaths) {
      if (!existsSync(searchPath)) continue;
      const entries = readdirSync(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = join(searchPath, entry.name);
        try {
          await this.load(skillDir);
        } catch (err) {
          this.logger.warn("Failed to load skill", { path: skillDir, error: String(err) });
        }
      }
    }
    this.logger.info("Skills loaded", { count: this.skills.size });
  }

  async load(path: string): Promise<void> {
    const manifestPath = join(path, "skill.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`No skill.json found at ${path}`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as SkillManifest;

    let transport;
    if (manifest.process?.port) {
      const callbackUrl = `http://localhost:${manifest.process.port}`;
      transport = new HttpSkillTransport(callbackUrl, this.logger);
    } else if (manifest.process?.command) {
      transport = new StdioSkillTransport(this.logger);
    } else {
      transport = new DirectSkillTransport(this.logger);
    }

    const skill = new Skill(manifest, transport, this.logger);

    skill.onLoopEvent((event) => {
      this.loopEmitter?.(event);
    });

    for (const eventType of skill.getHandledEvents()) {
      this.eventBus.registerDirect(eventType, (event) => skill.receiveFromLoop(event));
    }

    for (const toolSchema of skill.getTools()) {
      this.toolRegistry.register({
        name: toolSchema.name,
        description: toolSchema.description,
        parameters: toolSchema.parameters,
        execute: async (params, context) => {
          const toolEvent: Event = {
            id: `tool-${Date.now()}`,
            type: "tool_call",
            source: `agent:${context.agentId}`,
            timestamp: Date.now(),
            payload: { tool: toolSchema.name, params },
          };
          await skill.receiveFromLoop(toolEvent);
          return { output: "Tool call dispatched to skill" };
        },
        source: `skill:${manifest.name}`,
      });
    }

    await skill.start();
    this.skills.set(manifest.name, skill);
    this.logger.info("Skill loaded", { name: manifest.name, transport: transport.type });
  }

  async unload(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill) return;

    for (const tool of skill.getTools()) {
      this.toolRegistry.unregister(tool.name);
    }

    await skill.stop();
    this.skills.delete(name);
    this.logger.info("Skill unloaded", { name });
  }

  async reload(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill) return;
    for (const searchPath of this.searchPaths) {
      const skillDir = join(searchPath, name);
      if (existsSync(join(skillDir, "skill.json"))) {
        await this.unload(name);
        await this.load(skillDir);
        return;
      }
    }
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return [...this.skills.values()];
  }

  getTools(): ToolSchema[] {
    const tools: ToolSchema[] = [];
    for (const skill of this.skills.values()) {
      tools.push(...skill.getTools());
    }
    return tools;
  }

  startWatching(): void {
    if (this.watcher) return;
    for (const searchPath of this.searchPaths) {
      if (!existsSync(searchPath)) continue;
      this.watcher = watch(searchPath, { recursive: false }, (_event, filename) => {
        if (!filename) return;
        const skillDir = join(searchPath, filename);
        if (existsSync(join(skillDir, "skill.json"))) {
          this.reload(filename).catch((err) => {
            this.logger.warn("Skill hot-reload failed", { name: filename, error: String(err) });
          });
        }
      });
    }
  }

  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  async stopAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.stop();
    }
  }
}
