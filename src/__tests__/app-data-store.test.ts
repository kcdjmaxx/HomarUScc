// Test: test-AppDataStore.md | CRC: crc-AppDataStore.md | Seq: seq-apps-invoke.md
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { AppRegistry } from "../app-registry.js";
import { AppDataStore } from "../app-data-store.js";

const testBase = resolve(tmpdir(), `app-data-store-test-${Date.now()}`);

function makeLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function setup() {
  const dir = join(testBase, "apps");
  mkdirSync(dir, { recursive: true });
  const logger = makeLogger();
  const registry = new AppRegistry(dir, logger);
  const store = new AppDataStore(dir, registry);
  return { dir, registry, store };
}

describe("AppDataStore", () => {
  beforeEach(() => {
    mkdirSync(testBase, { recursive: true });
  });

  afterEach(() => {
    rmSync(testBase, { recursive: true, force: true });
  });

  it("read returns data.json contents", () => {
    const { dir, store } = setup();
    mkdirSync(join(dir, "test-app"), { recursive: true });
    writeFileSync(join(dir, "test-app", "data.json"), JSON.stringify({ items: [1, 2, 3] }));
    expect(store.read("test-app")).toEqual({ items: [1, 2, 3] });
  });

  it("read returns empty object when no data.json", () => {
    const { dir, store } = setup();
    mkdirSync(join(dir, "test-app"), { recursive: true });
    expect(store.read("test-app")).toEqual({});
  });

  it("write creates data.json", () => {
    const { dir, store } = setup();
    mkdirSync(join(dir, "test-app"), { recursive: true });
    store.write("test-app", { count: 42 });
    expect(existsSync(join(dir, "test-app", "data.json"))).toBe(true);
    expect(store.read("test-app")).toEqual({ count: 42 });
  });

  it("write overwrites existing data", () => {
    const { dir, store } = setup();
    mkdirSync(join(dir, "test-app"), { recursive: true });
    writeFileSync(join(dir, "test-app", "data.json"), JSON.stringify({ a: 1 }));
    store.write("test-app", { b: 2 });
    expect(store.read("test-app")).toEqual({ b: 2 });
  });

  it("describe generates summary from data", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "budget"), { recursive: true });
    writeFileSync(join(dir, "budget", "manifest.json"), JSON.stringify({
      name: "Budget Tracker", version: "1.0.0", description: "Track expenses",
    }));
    writeFileSync(join(dir, "budget", "data.json"), JSON.stringify({
      entries: [{ amount: 50 }], total: 50,
    }));
    registry.scan();
    const desc = store.describe("budget");
    expect(desc).toContain("Budget Tracker");
    expect(desc).toContain("entries");
    expect(desc).toContain("1 items");
  });

  it("describe handles empty data", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "empty"), { recursive: true });
    writeFileSync(join(dir, "empty", "manifest.json"), JSON.stringify({
      name: "Empty App", version: "1.0.0",
    }));
    registry.scan();
    const desc = store.describe("empty");
    expect(desc).toContain("No data stored yet");
  });

  it("invoke returns error for unknown app", () => {
    const { store } = setup();
    const result = store.invoke("nonexistent", "read");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown app");
  });

  it("invoke dispatches read hook", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "myapp"), { recursive: true });
    writeFileSync(join(dir, "myapp", "manifest.json"), JSON.stringify({
      name: "My App", version: "1.0.0",
    }));
    writeFileSync(join(dir, "myapp", "data.json"), JSON.stringify({ key: "value" }));
    registry.scan();
    const result = store.invoke("myapp", "read");
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ key: "value" });
  });

  it("invoke dispatches write hook", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "myapp"), { recursive: true });
    writeFileSync(join(dir, "myapp", "manifest.json"), JSON.stringify({
      name: "My App", version: "1.0.0",
    }));
    registry.scan();
    const result = store.invoke("myapp", "write", { newData: true });
    expect(result.isError).toBeUndefined();
    expect(store.read("myapp")).toEqual({ newData: true });
  });

  it("invoke returns error for unknown hook", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "myapp"), { recursive: true });
    writeFileSync(join(dir, "myapp", "manifest.json"), JSON.stringify({
      name: "My App", version: "1.0.0",
    }));
    registry.scan();
    const result = store.invoke("myapp", "invalid");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown hook");
  });

  it("invoke write requires data parameter", () => {
    const { dir, registry, store } = setup();
    mkdirSync(join(dir, "myapp"), { recursive: true });
    writeFileSync(join(dir, "myapp", "manifest.json"), JSON.stringify({
      name: "My App", version: "1.0.0",
    }));
    registry.scan();
    const result = store.invoke("myapp", "write");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("data parameter");
  });
});
