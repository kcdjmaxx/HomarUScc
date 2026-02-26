// Test: test-Scaffolder.md | CRC: crc-Scaffolder.md
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

// We need to mock HOME so Scaffolder uses our temp dir
const testBase = resolve(tmpdir(), `scaffolder-test-${Date.now()}`);

describe("Scaffolder", () => {
  let Scaffolder: any;

  beforeEach(async () => {
    mkdirSync(testBase, { recursive: true });
    // Override HOME before importing
    process.env.HOME = testBase;
    // Dynamic import to pick up the new HOME
    const mod = await import("../scaffolder.js");
    Scaffolder = mod.Scaffolder;
  });

  afterEach(() => {
    rmSync(testBase, { recursive: true, force: true });
  });

  function makeAnswers(overrides: Record<string, unknown> = {}) {
    return {
      agentName: null as string | null,
      userName: "",
      userContext: "",
      channels: new Set(["dashboard"]),
      telegramToken: null as string | null,
      identityPath: "template" as "template" | "alignment",
      soulContent: null as string | null,
      ...overrides,
    };
  }

  it("creates all required directories", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers());
    const base = resolve(testBase, ".homaruscc");
    expect(existsSync(base)).toBe(true);
    expect(existsSync(join(base, "identity"))).toBe(true);
    expect(existsSync(join(base, "journal"))).toBe(true);
    expect(existsSync(join(base, "memory"))).toBe(true);
    expect(existsSync(join(base, "transcripts"))).toBe(true);
  });

  it("writes config.json with telegram when selected", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers({
      channels: new Set(["telegram", "dashboard"]),
      telegramToken: "test-token",
    }));
    const config = JSON.parse(readFileSync(resolve(testBase, ".homaruscc", "config.json"), "utf8"));
    expect(config.channels.telegram).toBeDefined();
    expect(config.channels.telegram.token).toBe("${TELEGRAM_BOT_TOKEN}");
    expect(config.dashboard.enabled).toBe(true);
  });

  it("writes config.json without telegram when not selected", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers());
    const config = JSON.parse(readFileSync(resolve(testBase, ".homaruscc", "config.json"), "utf8"));
    expect(config.channels.telegram).toBeUndefined();
    expect(config.dashboard.enabled).toBe(true);
  });

  it("writes .env with telegram token", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers({ telegramToken: "123:ABC" }));
    const env = readFileSync(resolve(testBase, ".homaruscc", ".env"), "utf8");
    expect(env).toContain("TELEGRAM_BOT_TOKEN=123:ABC");
  });

  it("writes .env with commented placeholder when no token", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers());
    const env = readFileSync(resolve(testBase, ".homaruscc", ".env"), "utf8");
    expect(env).toContain("# TELEGRAM_BOT_TOKEN=");
    expect(env).not.toMatch(/^TELEGRAM_BOT_TOKEN=/m);
  });

  it("writes all 5 identity files", async () => {
    const s = new Scaffolder();
    await s.scaffold(makeAnswers({ agentName: "TestBot", userName: "Alice" }));
    const identityDir = resolve(testBase, ".homaruscc", "identity");
    const files = ["soul.md", "user.md", "state.md", "preferences.md", "disagreements.md"];
    for (const f of files) {
      expect(existsSync(join(identityDir, f))).toBe(true);
    }
  });

  it("returns list of created files", async () => {
    const s = new Scaffolder();
    const files = await s.scaffold(makeAnswers());
    // config.json + .env + 5 identity files = 7
    expect(files.length).toBe(7);
    expect(files.some((f: string) => f.endsWith("config.json"))).toBe(true);
    expect(files.some((f: string) => f.endsWith(".env"))).toBe(true);
    expect(files.some((f: string) => f.endsWith("soul.md"))).toBe(true);
  });
});
