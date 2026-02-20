// Built-in tools: browser_* — Playwright browser automation
import type { ToolDefinition, ToolResult } from "../types.js";
import type { BrowserService } from "../browser-service.js";

export function createBrowserTools(browserService: BrowserService): ToolDefinition[] {
  const browserNavigate: ToolDefinition = {
    name: "browser_navigate",
    description: "Navigate the browser to a URL. Returns page title and URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to" },
      },
      required: ["url"],
    },
    source: "builtin",
    async execute(params: unknown): Promise<ToolResult> {
      const { url } = params as { url: string };
      try {
        const result = await browserService.navigate(url);
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserSnapshot: ToolDefinition = {
    name: "browser_snapshot",
    description: "Get the accessibility tree of the current page.",
    parameters: { type: "object", properties: {} },
    source: "builtin",
    async execute(): Promise<ToolResult> {
      try {
        const result = await browserService.snapshot();
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserScreenshot: ToolDefinition = {
    name: "browser_screenshot",
    description: "Take a screenshot of the current page. Returns base64-encoded PNG.",
    parameters: { type: "object", properties: {} },
    source: "builtin",
    async execute(): Promise<ToolResult> {
      try {
        const result = await browserService.screenshot();
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserClick: ToolDefinition = {
    name: "browser_click",
    description: "Click an element on the page by CSS selector.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of element to click" },
      },
      required: ["selector"],
    },
    source: "builtin",
    async execute(params: unknown): Promise<ToolResult> {
      const { selector } = params as { selector: string };
      try {
        const result = await browserService.click(selector);
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserType: ToolDefinition = {
    name: "browser_type",
    description: "Type text into an input element by CSS selector.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of input element" },
        text: { type: "string", description: "Text to type" },
      },
      required: ["selector", "text"],
    },
    source: "builtin",
    async execute(params: unknown): Promise<ToolResult> {
      const { selector, text } = params as { selector: string; text: string };
      try {
        const result = await browserService.type(selector, text);
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserEvaluate: ToolDefinition = {
    name: "browser_evaluate",
    description: "Execute JavaScript in the browser page and return the result.",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
    source: "builtin",
    async execute(params: unknown): Promise<ToolResult> {
      const { script } = params as { script: string };
      try {
        const result = await browserService.evaluate(script);
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  const browserContent: ToolDefinition = {
    name: "browser_content",
    description: "Get the text content of the current page.",
    parameters: { type: "object", properties: {} },
    source: "builtin",
    async execute(): Promise<ToolResult> {
      try {
        const result = await browserService.getContent();
        return { output: result };
      } catch (err) {
        return { output: "", error: String(err) };
      }
    },
  };

  return [browserNavigate, browserSnapshot, browserScreenshot, browserClick, browserType, browserEvaluate, browserContent];
}
