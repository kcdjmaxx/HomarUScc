// Obsidian CLI wrapper — thin shim around `obsidian` CLI (v1.12+)
// Detects availability, shells out with execFile, parses JSON where available.
import { execFile } from "node:child_process";

const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60_000;

interface CliResult {
  stdout: string;
  stderr: string;
}

export class ObsidianCLI {
  private cachedAvailable: boolean | null = null;
  private cacheTime = 0;
  private vaultName: string | undefined;

  constructor(vaultName?: string) {
    this.vaultName = vaultName;
  }

  async isAvailable(): Promise<boolean> {
    if (this.cachedAvailable !== null && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      return this.cachedAvailable;
    }
    try {
      await this.run(["status"]);
      this.cachedAvailable = true;
    } catch {
      this.cachedAvailable = false;
      process.stderr.write("[WARN] Obsidian CLI not available — Obsidian may not be running\n");
    }
    this.cacheTime = Date.now();
    return this.cachedAvailable;
  }

  /** Invalidate availability cache (e.g. after Obsidian launches) */
  clearCache(): void {
    this.cachedAvailable = null;
  }

  // --- High-level methods ---

  async eval(code: string): Promise<string> {
    const result = await this.run(["eval", `code=${code}`]);
    return result.stdout;
  }

  async move(file: string, to: string): Promise<void> {
    await this.run(["move", `file=${file}`, `to=${to}`]);
  }

  async tagsRename(oldTag: string, newTag: string): Promise<void> {
    await this.run(["tags:rename", `old=${oldTag}`, `new=${newTag}`]);
  }

  async backlinks(file: string): Promise<string[]> {
    const result = await this.run(["backlinks", `file=${file}`, "--format", "json"]);
    return this.parseJsonArray(result.stdout);
  }

  async orphans(): Promise<string[]> {
    const result = await this.run(["orphans", "--format", "json"]);
    return this.parseJsonArray(result.stdout);
  }

  async search(query: string): Promise<unknown[]> {
    const result = await this.run(["search", `query=${query}`, "--format", "json"]);
    return this.parseJsonArray(result.stdout);
  }

  async tags(): Promise<string[]> {
    const result = await this.run(["tags", "--format", "json"]);
    return this.parseJsonArray(result.stdout);
  }

  async unresolved(): Promise<string[]> {
    const result = await this.run(["unresolved", "--format", "json"]);
    return this.parseJsonArray(result.stdout);
  }

  async properties(file: string): Promise<Record<string, unknown>> {
    const result = await this.run(["properties", `file=${file}`, "--format", "json"]);
    try {
      return JSON.parse(result.stdout);
    } catch {
      return {};
    }
  }

  async propertySet(file: string, key: string, value: string): Promise<void> {
    await this.run(["property:set", `file=${file}`, `${key}=${value}`]);
  }

  // --- Internal ---

  private run(args: string[]): Promise<CliResult> {
    const fullArgs = this.vaultName ? ["--vault", this.vaultName, ...args] : args;
    return new Promise((resolve, reject) => {
      execFile("obsidian", fullArgs, { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
        if (err) {
          process.stderr.write(`[WARN] obsidian CLI error: ${err.message}\n`);
          reject(err);
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  }

  private parseJsonArray(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fall back to line-split for non-JSON output
      return raw.split("\n").map((l) => l.trim()).filter(Boolean);
    }
  }
}
