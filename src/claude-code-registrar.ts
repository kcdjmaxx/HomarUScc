// CRC: crc-ClaudeCodeRegistrar.md | Seq: seq-first-run.md
// Detects Claude Code settings and registers HomarUScc as an MCP server.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { Interface as ReadlineInterface } from "node:readline";

export class ClaudeCodeRegistrar {
  private settingsLocations: string[];

  constructor() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    this.settingsLocations = [
      resolve(home, ".claude.json"),
      resolve(home, ".claude", "settings.json"),
    ];
  }

  // CRC: crc-ClaudeCodeRegistrar.md
  detectSettingsFile(): string | null {
    for (const path of this.settingsLocations) {
      if (existsSync(path)) return path;
    }
    return null;
  }

  // CRC: crc-ClaudeCodeRegistrar.md
  async promptRegister(rl: ReadlineInterface): Promise<void> {
    const settingsPath = this.detectSettingsFile();

    if (!settingsPath) {
      console.log("\n  Claude Code settings not found. You can manually add HomarUScc later.");
      console.log("  See: https://github.com/kcdjmaxx/homaruscc#claude-code-setup");
      return;
    }

    console.log(`\n  Found Claude Code settings at: ${settingsPath}`);
    const answer = await new Promise<string>((resolve) => {
      rl.question("  Register HomarUScc as an MCP server? [Y/n]: ", resolve);
    });

    if (answer.trim().toLowerCase() === "n") {
      console.log("  Skipped. You can add it manually later.");
      return;
    }

    try {
      this.register(settingsPath);
      console.log("  HomarUScc registered in Claude Code settings.");
    } catch (err) {
      console.log(`  Could not update settings: ${String(err)}`);
      console.log("  You can add it manually later.");
    }
  }

  // CRC: crc-ClaudeCodeRegistrar.md
  register(settingsPath: string): void {
    let settings: Record<string, unknown> = {};

    if (existsSync(settingsPath)) {
      const raw = readFileSync(settingsPath, "utf-8");
      settings = JSON.parse(raw) as Record<string, unknown>;
    }

    if (!settings.mcpServers || typeof settings.mcpServers !== "object") {
      settings.mcpServers = {};
    }

    const mcpServers = settings.mcpServers as Record<string, unknown>;
    mcpServers.homaruscc = this.buildMcpEntry();

    // Ensure parent directory exists (for ~/.claude/settings.json case)
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  // CRC: crc-ClaudeCodeRegistrar.md
  private buildMcpEntry(): Record<string, unknown> {
    return {
      command: "npx",
      args: ["homaruscc"],
    };
  }
}
