// Test: test-ClaudeCodeRegistrar.md | CRC: crc-ClaudeCodeRegistrar.md
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const testBase = resolve(tmpdir(), `registrar-test-${Date.now()}`);

describe("ClaudeCodeRegistrar", () => {
  let ClaudeCodeRegistrar: any;

  beforeEach(async () => {
    mkdirSync(testBase, { recursive: true });
    process.env.HOME = testBase;
    const mod = await import("../claude-code-registrar.js");
    ClaudeCodeRegistrar = mod.ClaudeCodeRegistrar;
  });

  afterEach(() => {
    rmSync(testBase, { recursive: true, force: true });
  });

  it("detects ~/.claude.json when it exists", () => {
    const path = resolve(testBase, ".claude.json");
    writeFileSync(path, JSON.stringify({ mcpServers: {} }));
    const registrar = new ClaudeCodeRegistrar();
    expect(registrar.detectSettingsFile()).toBe(path);
  });

  it("detects ~/.claude/settings.json as fallback", () => {
    mkdirSync(resolve(testBase, ".claude"), { recursive: true });
    const path = resolve(testBase, ".claude", "settings.json");
    writeFileSync(path, JSON.stringify({}));
    const registrar = new ClaudeCodeRegistrar();
    expect(registrar.detectSettingsFile()).toBe(path);
  });

  it("returns null when no settings file found", () => {
    const registrar = new ClaudeCodeRegistrar();
    expect(registrar.detectSettingsFile()).toBeNull();
  });

  it("registers MCP server entry", () => {
    const path = resolve(testBase, ".claude.json");
    writeFileSync(path, JSON.stringify({ mcpServers: {} }));
    const registrar = new ClaudeCodeRegistrar();
    registrar.register(path);
    const settings = JSON.parse(readFileSync(path, "utf8"));
    expect(settings.mcpServers.homaruscc).toBeDefined();
    expect(settings.mcpServers.homaruscc.command).toBe("npx");
    expect(settings.mcpServers.homaruscc.args).toEqual(["homaruscc"]);
  });

  it("preserves existing settings entries", () => {
    const path = resolve(testBase, ".claude.json");
    writeFileSync(path, JSON.stringify({
      mcpServers: { other: { command: "other-cmd" } },
      customKey: "value",
    }));
    const registrar = new ClaudeCodeRegistrar();
    registrar.register(path);
    const settings = JSON.parse(readFileSync(path, "utf8"));
    expect(settings.mcpServers.other.command).toBe("other-cmd");
    expect(settings.customKey).toBe("value");
    expect(settings.mcpServers.homaruscc).toBeDefined();
  });

  it("creates settings file from scratch if path does not exist", () => {
    const path = resolve(testBase, ".claude.json");
    const registrar = new ClaudeCodeRegistrar();
    registrar.register(path);
    expect(existsSync(path)).toBe(true);
    const settings = JSON.parse(readFileSync(path, "utf8"));
    expect(settings.mcpServers.homaruscc).toBeDefined();
  });
});
