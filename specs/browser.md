# Browser

**Language:** TypeScript
**Environment:** Node.js >= 22, Playwright

The browser service provides headless (or visible) browser automation via Playwright.

## Behavior

- Lazy initialization — browser only launches on first tool call
- Two modes: ephemeral (clean slate each session) or persistent (reuses cookies/localStorage/sessions via userDataDir)
- Uses Chromium by default
- Configurable viewport, proxy, executable path, and timeout (default 30s)

## MCP Tools

- `browser_navigate(url)` — go to URL, return page title and final URL
- `browser_snapshot()` — get the accessibility tree (aria snapshot) of the current page
- `browser_screenshot()` — take a screenshot, return base64 PNG
- `browser_click(selector)` — click an element by CSS selector
- `browser_type(selector, text)` — type text into an input by CSS selector
- `browser_evaluate(script)` — execute JavaScript in the page, return result
- `browser_content()` — get the full text content of the page

## Configuration

- Disabled by default, enabled via `browser.enabled: true` in config
- Persistent sessions require `browser.userDataDir` path (e.g., `~/.homaruscc/browser-data`)
