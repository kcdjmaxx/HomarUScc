// Plugin loader — discovers and loads backend plugins from dist/plugins/
// Plugins provide MCP tools and Express routes that get mounted by the core.
import { resolve, join } from "node:path";
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { Router } from "express";
import type { Logger } from "./types.js";

export interface PluginToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

export interface PluginExports {
  init(dataDir: string): void;
  routes?(router: Router): void;
  tools?(): PluginToolDef[];
  shutdown?(): void;
}

export interface PluginManifest {
  name: string;
  slug: string;
  description: string;
  version: string;
  type: "plugin";
  icon?: string;
  hasIndex?: boolean;
}

interface LoadedPlugin {
  slug: string;
  manifest: PluginManifest;
  exports: PluginExports;
}

export class PluginLoader {
  private plugins = new Map<string, LoadedPlugin>();
  private logger: Logger;
  private appsDir: string;
  private projectDir: string;

  constructor(projectDir: string, appsDir: string, logger: Logger) {
    this.projectDir = projectDir;
    this.appsDir = appsDir;
    this.logger = logger;
  }

  // Discover and load all plugins
  async loadAll(): Promise<void> {
    const pluginsDir = resolve(this.projectDir, "dist", "plugins");
    if (!existsSync(pluginsDir)) return;

    for (const slug of readdirSync(pluginsDir)) {
      const entryPath = resolve(pluginsDir, slug, "index.js");
      if (!existsSync(entryPath)) continue;

      // Check for manifest in ~/.homaruscc/apps/<slug>/
      const manifestPath = join(this.appsDir, slug, "manifest.json");
      let manifest: PluginManifest;

      if (existsSync(manifestPath)) {
        try {
          const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
          if (raw.type !== "plugin") continue; // Only load type: "plugin"
          manifest = { ...raw, slug };
        } catch (err) {
          this.logger.warn("Invalid plugin manifest", { slug, error: String(err) });
          continue;
        }
      } else {
        // Auto-create manifest for discovered plugins
        manifest = {
          name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          slug,
          description: "",
          version: "1.0.0",
          type: "plugin",
        };
        const dir = join(this.appsDir, slug);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const { writeFileSync } = await import("node:fs");
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      try {
        // Dynamic import of compiled plugin
        const mod = await import(entryPath) as PluginExports;

        // Ensure data directory exists
        const dataDir = join(this.appsDir, slug);
        if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

        // Initialize plugin
        mod.init(dataDir);

        this.plugins.set(slug, { slug, manifest, exports: mod });
        this.logger.info("Plugin loaded", { slug, name: manifest.name });
      } catch (err) {
        this.logger.error("Failed to load plugin", { slug, error: String(err) });
      }
    }

    this.logger.info("Plugin loading complete", { count: this.plugins.size });
  }

  // Collect all MCP tools from loaded plugins
  getAllTools(): PluginToolDef[] {
    const tools: PluginToolDef[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.exports.tools) {
        try {
          tools.push(...plugin.exports.tools());
        } catch (err) {
          this.logger.error("Plugin tools() failed", { slug: plugin.slug, error: String(err) });
        }
      }
    }
    return tools;
  }

  // Mount all plugin routes on an Express app
  mountRoutes(app: import("express").Application): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.exports.routes) {
        const router = Router();
        try {
          plugin.exports.routes(router);
          app.use(`/api/plugins/${plugin.slug}`, router);
          this.logger.info("Plugin routes mounted", { slug: plugin.slug, prefix: `/api/plugins/${plugin.slug}` });
        } catch (err) {
          this.logger.error("Plugin routes() failed", { slug: plugin.slug, error: String(err) });
        }
      }
    }
  }

  // Get list of loaded plugins (for status/API)
  getAll(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  // Shutdown all plugins
  shutdown(): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.exports.shutdown) {
        try {
          plugin.exports.shutdown();
        } catch (err) {
          this.logger.error("Plugin shutdown failed", { slug: plugin.slug, error: String(err) });
        }
      }
    }
  }
}
