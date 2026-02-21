# DreamCyclePrompt (timer prompt configuration)
**Requirements:** R109, R110, R111, R112, R113, R114, R118, R119, R120, R121, R122
**Refs:** ref-dreams-brainstorm

## Knows
- schedule: cron expression and timezone for nightly trigger
- phases: ordered list of dream phases to execute
- tokenBudget: target token usage across all phases
- outputPath: key prefix for storing dream content
- reportChatId: Telegram chat ID for morning digest

## Does
- Triggers nightly via TimerService cron at 3am CST (R109)
- Executes three phases sequentially: consolidation, associative, overfitting prevention (R110)
- Phase 1: searches recent memories, evaluates importance, reinforces significant ones (R111)
- Phase 2: searches diverse memories, force-connects them, generates fuzzy output (R112, R118)
- Phase 3: pulls random preference, challenges its validity (R113)
- Stores dream output under dreams/ prefix (R114)
- Sends morning digest via Telegram after completion (R119)
- Instructs waking behavior to note dream-origin search results (R120)

## Collaborators
- TimerService: schedules the nightly trigger
- MemoryIndex (via memory_search/memory_store MCP tools): reads and writes memories
- TelegramChannelAdapter (via telegram_send MCP tool): sends morning digest
- IdentityManager: provides preferences/patterns for overfitting prevention phase

## Sequences
- seq-dream-cycle.md

## Notes
This is a timer prompt, not a TypeScript class. The "code" lives in the `.claude/skills/homaruscc`
skill file as the timer prompt string. Claude Code executes the phases using MCP tools.
