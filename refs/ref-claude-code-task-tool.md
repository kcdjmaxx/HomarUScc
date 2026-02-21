# ref-claude-code-task-tool
- **Source:** internal (Claude Code tool documentation)
- **Type:** local
- **Fetched:** 2026-02-22
- **Requirements:** R133, R135, R143, R144
- **Status:** active
- **Summary:** Claude Code Task tool for spawning subagents with isolated context windows. Supports foreground and background execution, multiple agent types.

## Details

### Task Tool Parameters
- `prompt`: The task description for the agent
- `subagent_type`: Agent type (general-purpose, Bash, Explore, Plan, code-simplifier, etc.)
- `run_in_background`: When true, returns immediately with an output_file path; agent runs asynchronously
- `model`: Optional model override (sonnet, opus, haiku)
- `description`: Short 3-5 word summary

### Background Agents
- When `run_in_background: true`, the tool returns immediately with a task ID and output_file path
- Use `TaskOutput` tool to check on progress (block=false for non-blocking, block=true to wait)
- The agent runs in its own context window — does not consume main conversation tokens
- Multiple background agents can run concurrently

### Agent Types Relevant to HomarUScc
- `general-purpose`: Full tool access including file editing, writing, bash. Use for implementation tasks.
- `Explore`: Read-only, fast codebase exploration. Good for research.
- `Bash`: Command execution only. Good for git operations, builds.

### Key Constraints
- Background agents cannot interact with the user directly
- Agent results are returned as text to the calling conversation
- No direct way for an agent to send Telegram messages (must route through main loop)
- Each agent starts fresh — no shared context between agents
- The calling conversation must provide all necessary context in the prompt
