// CRC: crc-ToolRegistry.md
// Built-in tool registration — adapted from HomarUS
import type { ToolRegistry } from "../tool-registry.js";
import type { MemoryIndex } from "../memory-index.js";
import type { BrowserService } from "../browser-service.js";
import type { Logger } from "../types.js";
import { bashTool } from "./bash.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { gitTool } from "./git.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { createMemoryTools } from "./memory.js";
import { createBrowserTools } from "./browser.js";

export function registerBuiltinTools(
  registry: ToolRegistry,
  memoryIndex: MemoryIndex,
  logger: Logger,
  browserService?: BrowserService,
): void {
  // group:fs
  registry.register(readTool);
  registry.register(writeTool);
  registry.register(editTool);
  registry.register(globTool);
  registry.register(grepTool);

  // group:runtime
  registry.register(bashTool);
  registry.register(gitTool);

  // group:web
  registry.register(webFetchTool);
  registry.register(webSearchTool);

  // group:memory
  for (const tool of createMemoryTools(memoryIndex)) {
    registry.register(tool);
  }

  // group:browser
  if (browserService) {
    for (const tool of createBrowserTools(browserService)) {
      registry.register(tool);
    }
  }

  const tools = [
    readTool.name, writeTool.name, editTool.name, globTool.name, grepTool.name,
    bashTool.name, gitTool.name,
    webFetchTool.name, webSearchTool.name,
    "memory_search", "memory_get", "memory_store",
  ];
  if (browserService) {
    tools.push("browser_navigate", "browser_snapshot", "browser_screenshot", "browser_click", "browser_type", "browser_evaluate", "browser_content");
  }

  logger.info("Built-in tools registered", { count: tools.length, tools });
}
