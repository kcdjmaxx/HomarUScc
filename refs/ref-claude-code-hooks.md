# ref-claude-code-hooks
- **Source:** https://code.claude.com/docs/en/hooks-guide
- **Type:** web
- **Fetched:** 2026-02-20
- **Requirements:** R75, R76, R78, R81
- **Status:** active
- **Summary:** Claude Code hooks system — shell commands that execute in response to lifecycle events (PreCompact, SessionStart, etc.)

## Details

### PreCompact Hook
Fires before context compaction begins. Supports matcher for "auto" vs "manual" compaction.

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s http://localhost:3120/api/pre-compact"
          }
        ]
      }
    ]
  }
}
```

**Critical limitation:** Hook stdout is injected into the context that is about to be summarized. Content gets paraphrased/lossy-compressed (~60-70% framework compliance after compaction).

### SessionStart Hook with compact matcher
Fires after compaction completes. Stdout is injected into the fresh post-compaction context — survives verbatim.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s http://localhost:3120/api/post-compact"
          }
        ]
      }
    ]
  }
}
```

### Context Window Thresholds
- Opus 4.6 context window: 200K tokens
- Auto-compact trigger (CLI): ~75% usage (~25% remaining)
- Auto-compact trigger (VS Code): ~65% usage
- Post-compaction reduction: 50-70% of original token count
- Not user-configurable (requested in issue #10691)

### MCP Limitations
- No MCP protocol-level notification for context changes
- MCP servers are completely blind to compaction
- Only Claude Code hooks provide compaction signals

### OpenClaw's Approach (for comparison)
OpenClaw counts tokens per turn and uses a two-threshold system:
1. Soft threshold: triggers "write memory now" silent agentic turn
2. Hard threshold: actual compaction point
The flush uses a NO_REPLY convention so users see no output.
