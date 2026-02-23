#!/usr/bin/env node
// CRC: crc-Cli.md | Seq: seq-first-run.md, seq-normal-start.md
// CLI entry point — detects config and delegates to wizard or proxy.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Seq: seq-first-run.md
function resolveConfigPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return resolve(home, ".homaruscc", "config.json");
}

async function main(): Promise<void> {
  const configPath = resolveConfigPath();

  if (existsSync(configPath)) {
    // Seq: seq-normal-start.md
    await import("./mcp-proxy.js");
  } else {
    // Seq: seq-first-run.md
    const { Wizard } = await import("./wizard.js");
    const wizard = new Wizard();
    await wizard.run();
  }
}

main().catch((err) => {
  process.stderr.write(`[FATAL] [cli] ${String(err)}\n`);
  process.exit(1);
});
