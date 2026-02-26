// CRC: crc-AppDataStore.md | Seq: seq-apps-invoke.md
// R189, R190, R191, R192, R193, R194, R196, R209
// AppDataStore -- read/write/describe operations on app data.json files.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppManifest, AppRegistry } from "./app-registry.js";

export class AppDataStore {
  private appsDir: string;
  private registry: AppRegistry;

  constructor(appsDir: string, registry: AppRegistry) {
    this.appsDir = appsDir;
    this.registry = registry;
  }

  // CRC: crc-AppDataStore.md
  // R191, R194: Read app data.json, return empty object if not found
  read(slug: string): Record<string, unknown> {
    const dataPath = join(this.appsDir, slug, "data.json");
    if (!existsSync(dataPath)) return {};
    try {
      return JSON.parse(readFileSync(dataPath, "utf8"));
    } catch {
      return {};
    }
  }

  // CRC: crc-AppDataStore.md
  // R192, R194, R195: Write JSON payload to app data.json
  write(slug: string, data: Record<string, unknown>): void {
    const dataPath = join(this.appsDir, slug, "data.json");
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
  }

  // CRC: crc-AppDataStore.md
  // R193: Generate natural language summary of app state
  describe(slug: string): string {
    const manifest = this.registry.get(slug);
    const data = this.read(slug);
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return `${manifest?.name ?? slug}: No data stored yet.`;
    }

    const lines = [`${manifest?.name ?? slug} (v${manifest?.version ?? "?"}):`, manifest?.description ?? ""];
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        lines.push(`  ${key}: ${value.length} items`);
      } else if (typeof value === "object" && value !== null) {
        lines.push(`  ${key}: ${Object.keys(value).length} fields`);
      } else {
        lines.push(`  ${key}: ${String(value)}`);
      }
    }
    return lines.join("\n");
  }

  // CRC: crc-AppDataStore.md
  // R196, R209: Dispatch to read/write/describe by hook name
  invoke(slug: string, hook: string, params?: Record<string, unknown>): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    const manifest = this.registry.get(slug);
    if (!manifest) {
      return { content: [{ type: "text", text: `Unknown app: ${slug}` }], isError: true };
    }

    switch (hook) {
      case "read":
        return { content: [{ type: "text", text: JSON.stringify(this.read(slug), null, 2) }] };
      case "write":
        if (!params) {
          return { content: [{ type: "text", text: "Write hook requires data parameter" }], isError: true };
        }
        this.write(slug, params);
        return { content: [{ type: "text", text: "Data written successfully" }] };
      case "describe":
        return { content: [{ type: "text", text: this.describe(slug) }] };
      default:
        return { content: [{ type: "text", text: `Unknown hook: ${hook}` }], isError: true };
    }
  }
}
