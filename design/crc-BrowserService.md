# BrowserService
**Requirements:** R48, R49, R50, R51, R52
**Refs:** ref-playwright

## Knows
- browser: Playwright browser instance (lazy)
- context: browser context (ephemeral or persistent)
- page: active page
- config: BrowserConfig (headless, viewport, proxy, timeout, userDataDir)

## Does
- ensureBrowser: lazy-launch on first use, create context and page
- navigate: goto URL, return title + final URL
- snapshot: get accessibility tree (ariaSnapshot)
- screenshot: capture page as base64 PNG
- click: click element by CSS selector
- type: fill input by CSS selector
- evaluate: execute JavaScript, return result
- getContent: extract page text content
- stop: close browser and context

## Collaborators
- HomarUScc: creates on startup if enabled
- ToolRegistry: browser tools registered as built-in tools

## Sequences
- seq-browser-action.md
