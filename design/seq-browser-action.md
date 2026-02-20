# Sequence: Browser Action

```
ClaudeCode     McpServer      McpTools      BrowserService    Playwright
    |              |              |              |                |
    |--CallTool--->|              |              |                |
    | browser_*    |              |              |                |
    |              |--handler()-->|              |                |
    |              |              |--action()--->|                |
    |              |              |              |--ensureBrowser()|
    |              |              |              |  (lazy init)   |
    |              |              |              |--launch()---------------->|
    |              |              |              |<--browser+page-----------|
    |              |              |              |                |
    |              |              |              |--page.action()----------->|
    |              |              |              |<--result------------------|
    |              |              |<--result-----|                |
    |              |<--formatted--|              |                |
    |<--result-----|              |              |                |
```
