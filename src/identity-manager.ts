// CRC: crc-IdentityManager.md | Seq: seq-startup.md
// Identity manager — from HomarUS
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Logger } from "./types.js";

export interface PromptBuildOptions {
  channel?: string;
  taskOverlay?: string;
  taskPrompt?: string;
}

export class IdentityManager {
  private soulContent = "";
  private userContent = "";
  private overlays = new Map<string, string>();
  private workspaceFiles = new Map<string, string>();
  private identityDir: string;
  private workspaceDir: string;
  private logger: Logger;

  constructor(logger: Logger, identityDir: string, workspaceDir: string) {
    this.logger = logger;
    this.identityDir = identityDir;
    this.workspaceDir = workspaceDir;
  }

  load(): void {
    this.soulContent = this.readFile(resolve(this.identityDir, "soul.md"));
    this.userContent = this.readFile(resolve(this.identityDir, "user.md"));
    this.loadOverlays();
    this.loadWorkspaceFiles();
    this.logger.info("Identity loaded", {
      hasSoul: this.soulContent.length > 0,
      hasUser: this.userContent.length > 0,
      overlays: this.overlays.size,
      workspaceFiles: this.workspaceFiles.size,
    });
  }

  reload(): void {
    this.overlays.clear();
    this.workspaceFiles.clear();
    this.load();
  }

  buildSystemPrompt(options: PromptBuildOptions = {}): string {
    const parts: string[] = [];

    if (this.soulContent) parts.push(this.soulContent);
    if (this.userContent) parts.push(this.userContent);

    if (options.channel) {
      const overlay = this.overlays.get(options.channel);
      if (overlay) parts.push(overlay);
    }

    if (options.taskOverlay) {
      const overlay = this.overlays.get(options.taskOverlay);
      if (overlay) parts.push(overlay);
    }

    for (const [name, content] of this.workspaceFiles) {
      if (content) parts.push(`## ${name}\n${content}`);
    }

    if (options.taskPrompt) parts.push(options.taskPrompt);

    return parts.join("\n\n---\n\n");
  }

  getSoul(): string {
    return this.soulContent;
  }

  getUser(): string {
    return this.userContent;
  }

  getOverlay(name: string): string | undefined {
    return this.overlays.get(name);
  }

  getWorkspaceFile(name: string): string | undefined {
    return this.workspaceFiles.get(name);
  }

  listOverlays(): string[] {
    return [...this.overlays.keys()];
  }

  private loadOverlays(): void {
    const overlayDir = resolve(this.identityDir, "overlays");
    if (!existsSync(overlayDir)) return;

    for (const file of readdirSync(overlayDir)) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(/\.md$/, "");
      const content = this.readFile(join(overlayDir, file));
      if (content) this.overlays.set(name, content);
    }
  }

  private loadWorkspaceFiles(): void {
    if (!existsSync(this.workspaceDir)) return;

    for (const file of readdirSync(this.workspaceDir)) {
      if (!file.endsWith(".md")) continue;
      const content = this.readFile(join(this.workspaceDir, file));
      if (content) this.workspaceFiles.set(file, content);
    }
  }

  private readFile(path: string): string {
    if (!existsSync(path)) return "";
    try {
      return readFileSync(path, "utf-8").trim();
    } catch (err) {
      this.logger.warn("Failed to read identity file", { path, error: String(err) });
      return "";
    }
  }
}
