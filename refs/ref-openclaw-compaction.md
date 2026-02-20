# ref-openclaw-compaction
- **Source:** https://docs.openclaw.ai/concepts/compaction
- **Type:** web
- **Fetched:** 2026-02-20
- **Requirements:** R75, R77, R80
- **Status:** active
- **Summary:** OpenClaw's auto-flush before compaction — two-threshold token counting with silent agentic turn for memory persistence.

## Details

### Architecture
- Counts tokens on every turn using model's tokenizer
- Two thresholds: soft (flush trigger) and hard (compaction point)
- Soft threshold default: 4000 tokens before hard threshold

### Flush Mechanism
1. Injects silent agentic turn with "write memory now" directive
2. Agent writes durable state to memory/YYYY-MM-DD.md
3. Uses NO_REPLY convention (user sees nothing)
4. Tracked in sessions.json to run only once per compaction cycle

### Configuration
```yaml
agents.defaults.compaction.memoryFlush:
  enabled: true
  softThresholdTokens: 4000
  prompt: "..."
  systemPrompt: "..."
```
