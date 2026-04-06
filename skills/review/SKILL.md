---
name: review
description: Multi-agent parallel code review. Spawns 4+ specialized reviewer agents (correctness, simplicity, security, style) that produce a consolidated review report with severity-ranked findings. TRIGGER when user says "review this code", "code review", "check my changes", "review the PR", or after significant code changes. Invoked with /review.
---

# Review

Parallel code review that spawns multiple agents, each examining code from a different angle. Returns a consolidated report with findings ranked by severity.

## Usage

```
/review                          -- review all uncommitted changes
/review src/homaruscc.ts         -- review a specific file
/review --scope last-commit      -- review the last commit
/review --scope branch           -- review all changes on the current branch vs main
```

## How It Works

### Step 1: Determine Scope

Figure out what code to review:
- No args: `git diff` (unstaged) + `git diff --cached` (staged)
- File path: read the file, plus its recent git history
- `--scope last-commit`: `git diff HEAD~1`
- `--scope branch`: `git diff main...HEAD`

If the diff is empty, tell the user there's nothing to review.

### Step 2: Spawn Parallel Reviewers

Launch all reviewers simultaneously using the Agent tool. Each gets the same diff/code but checks from a different angle.

**Reviewer 1: Security Sentinel**
```
Examine this code for security issues:
- Command injection via unsanitized input to shell commands
- Path traversal in file operations
- Secrets or tokens in code
- Unsafe eval or dynamic code execution
- Missing input validation at system boundaries
- OWASP top 10 where applicable

Code to review:
<paste diff/code>

Return findings as JSON: [{"severity": "critical|high|medium|low", "location": "file:line", "issue": "description", "fix": "suggestion"}]
If no issues found, return an empty array.
```

**Reviewer 2: Architecture & Patterns**
```
Examine this code for architectural issues:
- Does it follow the existing patterns in the codebase?
- Are abstractions at the right level?
- Is there unnecessary coupling between modules?
- Does it respect the two-process architecture (proxy + backend)?
- Are MCP tool definitions following the established pattern?
- Is state managed correctly (server-side vs client-side)?

Code to review:
<paste diff/code>

Return findings as JSON: [{"severity": "critical|high|medium|low", "location": "file:line", "issue": "description", "fix": "suggestion"}]
If no issues found, return an empty array.
```

**Reviewer 3: MCP & Identity System**
```
Examine this code for MCP and identity system issues:
- Do MCP tools follow the name/args convention?
- Is stdout kept clean for MCP protocol (logging to stderr only)?
- Does the code respect identity file boundaries (soul.md protected section)?
- Are memory operations using correct key conventions (local/user/preferences/, etc.)?
- Does the code handle post-compaction identity re-injection correctly?
- Are event watermarks respected?

Code to review:
<paste diff/code>

Return findings as JSON: [{"severity": "critical|high|medium|low", "location": "file:line", "issue": "description", "fix": "suggestion"}]
If no issues found, return an empty array.
```

**Reviewer 4: Simplicity**
```
Examine this code for unnecessary complexity:
- Is there over-engineering? Features built for hypothetical futures?
- Are there abstractions that only have one consumer?
- Could any of this be simpler while achieving the same result?
- Are there redundant error handlers or validation for impossible states?
- Is there dead code or unused imports?
- Could three similar lines replace a premature abstraction?

Code to review:
<paste diff/code>

Return findings as JSON: [{"severity": "critical|high|medium|low", "location": "file:line", "issue": "description", "fix": "suggestion"}]
If no issues found, return an empty array.
```

**Reviewer 5: Data Integrity**
```
Examine this code for data integrity issues:
- SQLite operations: are transactions used where needed? WAL mode respected?
- Memory index: could writes corrupt the vector/FTS index?
- File operations: are writes atomic? Could partial writes leave bad state?
- Timer persistence: could timer state get out of sync with disk?
- Event delivery: could events be lost or double-delivered?
- Config changes: could hot-reload leave inconsistent state?

Code to review:
<paste diff/code>

Return findings as JSON: [{"severity": "critical|high|medium|low", "location": "file:line", "issue": "description", "fix": "suggestion"}]
If no issues found, return an empty array.
```

### Step 3: Consolidate

After all agents return, merge their findings into a single report:

1. Deduplicate (different reviewers may flag the same issue)
2. Sort by severity (critical → high → medium → low)
3. Group by file

### Step 4: Report

Write the consolidated report to stdout in this format:

```
## Code Review: <scope description>

### Critical (X)
- **file:line** — <issue> → <fix>

### High (X)
- **file:line** — <issue> → <fix>

### Medium (X)
- **file:line** — <issue> → <fix>

### Low (X)
- **file:line** — <issue> → <fix>

### Summary
X total findings across Y files. Z critical issues require attention before committing.
```

If invoked from Telegram, send a summary via `telegram_send` with the count of findings per severity level and the location of the full report.

## Notes

- Reviewers run as foreground agents (need results before consolidating)
- Each reviewer should take 10-30 seconds
- Total review time: ~30-60 seconds for all 5 in parallel
- Don't review generated files (package-lock.json, dist/, etc.)
- For large diffs (>500 lines), split into logical chunks and run reviewers per chunk
