// CRC: crc-AppRegistry.md | Seq: seq-apps-startup.md
// R186, R187, R197, R198, R204, R205, R206, R207
// AppRegistry -- scans ~/.homaruscc/apps/ for manifest.json files and provides app metadata.
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "./types.js";

export interface AppManifest {
  name: string;
  slug: string;
  description: string;
  version: string;
  icon?: string;
  hasIndex?: boolean;
  hooks?: Record<string, { description?: string; schema?: unknown }>;
}

export class AppRegistry {
  private apps = new Map<string, AppManifest>();
  private appsDir: string;
  private logger: Logger;

  constructor(appsDir: string, logger: Logger) {
    this.appsDir = appsDir;
    this.logger = logger;
    // R205: Ensure apps directory exists
    if (!existsSync(appsDir)) {
      mkdirSync(appsDir, { recursive: true });
    }
  }

  // CRC: crc-AppRegistry.md | Seq: seq-apps-startup.md
  // R197: Scan all */manifest.json under appsDir
  scan(): void {
    this.apps.clear();
    if (!existsSync(this.appsDir)) return;

    for (const slug of readdirSync(this.appsDir)) {
      const manifestPath = join(this.appsDir, slug, "manifest.json");
      if (!existsSync(manifestPath)) continue;

      try {
        const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
        const manifest = this.validateManifest(raw, slug);
        if (manifest) {
          // Check if app has index.html
          manifest.hasIndex = existsSync(join(this.appsDir, slug, "index.html"));
          this.apps.set(slug, manifest);
        }
      } catch (err) {
        // R206: Invalid manifests are logged and skipped
        this.logger.warn("Skipping invalid app manifest", { slug, error: String(err) });
      }
    }

    this.logger.info("App registry scanned", { count: this.apps.size });
  }

  // CRC: crc-AppRegistry.md
  get(slug: string): AppManifest | undefined {
    return this.apps.get(slug);
  }

  // CRC: crc-AppRegistry.md
  // R198, R207: Return all registered app manifests
  getAll(): AppManifest[] {
    return Array.from(this.apps.values());
  }

  // CRC: crc-AppRegistry.md
  // R187: Validate manifest has required fields
  validateManifest(raw: Record<string, unknown>, slug: string): AppManifest | null {
    if (typeof raw.name !== "string" || !raw.name) {
      this.logger.warn("App manifest missing name", { slug });
      return null;
    }
    if (typeof raw.version !== "string" || !raw.version) {
      this.logger.warn("App manifest missing version", { slug });
      return null;
    }

    return {
      name: raw.name as string,
      slug,
      description: (raw.description as string) ?? "",
      version: raw.version as string,
      icon: raw.icon as string | undefined,
      hooks: raw.hooks as Record<string, { description?: string; schema?: unknown }> | undefined,
    };
  }

  getAppsDir(): string {
    return this.appsDir;
  }
}
