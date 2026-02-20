// CRC: crc-Config.md | Seq: seq-startup.md
// Config system — adapted from HomarUS for homaruscc
import { readFileSync, existsSync, watchFile, unwatchFile } from "node:fs";
import { resolve, dirname } from "node:path";
import { config as loadDotenv } from "dotenv";
import type { ConfigData, Logger } from "./types.js";

const DEFAULT_CONFIG: ConfigData = {
  channels: {},
  memory: { search: { vectorWeight: 0.7, ftsWeight: 0.3 } },
  skills: { paths: [] },
  dashboard: { port: 3120, enabled: true },
  timers: { enabled: true },
  identity: {},
  browser: { enabled: false, headless: true },
};

const SAFE_KEYS = new Set([
  "memory.search",
  "skills.paths",
  "timers.enabled",
  "dashboard.enabled",
]);

export class Config {
  private data: ConfigData = structuredClone(DEFAULT_CONFIG);
  private configPath: string;
  private watching = false;
  private logger: Logger;

  constructor(logger: Logger, configPath?: string) {
    this.logger = logger;
    this.configPath = configPath ?? this.resolveConfigPath();
  }

  load(path?: string): ConfigData {
    if (path) this.configPath = path;
    this.loadEnvFile();

    if (!existsSync(this.configPath)) {
      this.logger.info("No config file found, using defaults", { path: this.configPath });
      return this.data;
    }

    const raw = readFileSync(this.configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const resolved = this.resolveEnvVars(parsed);
    this.data = this.merge(DEFAULT_CONFIG, resolved as Partial<ConfigData>);
    this.logger.info("Config loaded", { path: this.configPath });
    return this.data;
  }

  get<T = unknown>(key: string): T | undefined {
    const parts = key.split(".");
    let current: unknown = this.data;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current as T;
  }

  getSection<T = unknown>(section: string): T {
    return (this.data as unknown as Record<string, unknown>)[section] as T;
  }

  getAll(): ConfigData {
    return this.data;
  }

  private resolveEnvVars(obj: unknown): unknown {
    if (typeof obj === "string") {
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
        return process.env[varName] ?? "";
      });
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveEnvVars(item));
    }
    if (obj !== null && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.resolveEnvVars(value);
      }
      return result;
    }
    return obj;
  }

  private loadEnvFile(): void {
    const envPath = resolve(dirname(this.configPath), ".env");
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath });
      this.logger.debug("Loaded .env file", { path: envPath });
    }
  }

  startWatching(onChange: (safeChange: boolean) => void): void {
    if (this.watching) return;
    this.watching = true;

    watchFile(this.configPath, { interval: 2000 }, () => {
      try {
        const oldData = structuredClone(this.data);
        this.load();
        const safe = this.isSafeChange(oldData, this.data);
        if (!safe) {
          this.logger.warn("Config change requires restart for full effect");
        }
        onChange(safe);
      } catch (err) {
        this.logger.error("Failed to reload config", { error: String(err) });
      }
    });
  }

  stopWatching(): void {
    if (!this.watching) return;
    unwatchFile(this.configPath);
    this.watching = false;
  }

  private isSafeChange(oldConfig: ConfigData, newConfig: ConfigData): boolean {
    const oldJson = JSON.stringify(oldConfig);
    const newJson = JSON.stringify(newConfig);
    if (oldJson === newJson) return true;

    const oldFlat = this.flatten(oldConfig);
    const newFlat = this.flatten(newConfig);
    const allKeys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);

    for (const key of allKeys) {
      if (JSON.stringify(oldFlat[key]) !== JSON.stringify(newFlat[key])) {
        const isSafe = [...SAFE_KEYS].some((sk) => key.startsWith(sk));
        if (!isSafe) return false;
      }
    }
    return true;
  }

  private resolveConfigPath(): string {
    const projectPath = resolve(process.cwd(), "homaruscc.json");
    if (existsSync(projectPath)) return projectPath;

    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    return resolve(home, ".homaruscc", "config.json");
  }

  private merge(defaults: ConfigData, overrides: Partial<ConfigData>): ConfigData {
    const result = structuredClone(defaults);
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== null) {
        const resultObj = result as unknown as Record<string, unknown>;
        if (typeof value === "object" && !Array.isArray(value) && typeof resultObj[key] === "object") {
          resultObj[key] = {
            ...(resultObj[key] as Record<string, unknown>),
            ...(value as Record<string, unknown>),
          };
        } else {
          resultObj[key] = value;
        }
      }
    }
    return result;
  }

  private flatten(obj: unknown, prefix = ""): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          Object.assign(result, this.flatten(value, fullKey));
        } else {
          result[fullKey] = value;
        }
      }
    }
    return result;
  }
}
