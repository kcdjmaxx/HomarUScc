// Test: test-AppRegistry.md | CRC: crc-AppRegistry.md | Seq: seq-apps-startup.md
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { AppRegistry } from "../app-registry.js";

const testBase = resolve(tmpdir(), `app-registry-test-${Date.now()}`);

function makeLogger() {
  const warnings: string[] = [];
  return {
    logger: {
      debug() {},
      info() {},
      warn(msg: string) { warnings.push(msg); },
      error() {},
    },
    warnings,
  };
}

describe("AppRegistry", () => {
  beforeEach(() => {
    mkdirSync(testBase, { recursive: true });
  });

  afterEach(() => {
    rmSync(testBase, { recursive: true, force: true });
  });

  it("creates apps directory if missing", () => {
    const dir = join(testBase, "apps");
    const { logger } = makeLogger();
    new AppRegistry(dir, logger);
    expect(existsSync(dir)).toBe(true);
  });

  it("scan discovers valid manifests", () => {
    const dir = join(testBase, "apps");
    mkdirSync(join(dir, "budget"), { recursive: true });
    mkdirSync(join(dir, "reading"), { recursive: true });
    writeFileSync(join(dir, "budget", "manifest.json"), JSON.stringify({
      name: "Budget Tracker", version: "1.0.0", description: "Track expenses",
    }));
    writeFileSync(join(dir, "reading", "manifest.json"), JSON.stringify({
      name: "Reading List", version: "0.1.0", description: "Books to read",
    }));

    const { logger } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    reg.scan();
    expect(reg.getAll().length).toBe(2);
    expect(reg.get("budget")?.name).toBe("Budget Tracker");
    expect(reg.get("reading")?.name).toBe("Reading List");
  });

  it("scan skips invalid manifests", () => {
    const dir = join(testBase, "apps");
    mkdirSync(join(dir, "valid"), { recursive: true });
    mkdirSync(join(dir, "invalid"), { recursive: true });
    writeFileSync(join(dir, "valid", "manifest.json"), JSON.stringify({
      name: "Valid App", version: "1.0.0",
    }));
    // Missing name
    writeFileSync(join(dir, "invalid", "manifest.json"), JSON.stringify({
      version: "1.0.0",
    }));

    const { logger, warnings } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    reg.scan();
    expect(reg.getAll().length).toBe(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("get returns undefined for nonexistent slug", () => {
    const dir = join(testBase, "apps");
    const { logger } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    reg.scan();
    expect(reg.get("nonexistent")).toBeUndefined();
  });

  it("detects hasIndex when index.html exists", () => {
    const dir = join(testBase, "apps");
    mkdirSync(join(dir, "myapp"), { recursive: true });
    writeFileSync(join(dir, "myapp", "manifest.json"), JSON.stringify({
      name: "My App", version: "1.0.0",
    }));
    writeFileSync(join(dir, "myapp", "index.html"), "<html></html>");

    const { logger } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    reg.scan();
    expect(reg.get("myapp")?.hasIndex).toBe(true);
  });

  it("validateManifest rejects missing name", () => {
    const dir = join(testBase, "apps");
    const { logger, warnings } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    expect(reg.validateManifest({ version: "1.0" }, "test")).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("validateManifest rejects missing version", () => {
    const dir = join(testBase, "apps");
    const { logger, warnings } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    expect(reg.validateManifest({ name: "App" }, "test")).toBeNull();
  });

  it("scan skips directories without manifest.json", () => {
    const dir = join(testBase, "apps");
    mkdirSync(join(dir, "no-manifest"), { recursive: true });
    writeFileSync(join(dir, "no-manifest", "data.json"), "{}");

    const { logger } = makeLogger();
    const reg = new AppRegistry(dir, logger);
    reg.scan();
    expect(reg.getAll().length).toBe(0);
  });
});
