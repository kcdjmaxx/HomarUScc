# Identity

**Language:** TypeScript
**Environment:** Node.js >= 22

The identity system shapes the assistant's personality and user context through markdown files.

## Files

- `soul.md` — core identity: personality, values, behavioral boundaries
- `user.md` — user preferences, communication style, important context
- `overlays/` — optional per-channel or per-task overlays (e.g., `telegram.md` adds Telegram-specific instructions)
- Workspace directory — additional .md files included in every system prompt with `## filename` headers

## System Prompt Assembly

Parts are joined with `---` separators in order:
1. soul.md
2. user.md
3. Channel-specific overlay (if channel option provided)
4. Task-specific overlay (if taskOverlay option provided)
5. All workspace files
6. Custom task prompt (if provided)

## MCP Resources

- `identity://soul` — read the soul.md content
- `identity://user` — read the user.md content
