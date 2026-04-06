---
name: compact
description: Check and compact identity files that exceed character limits. Uses LLM-assisted consolidation to rewrite content at higher density without losing information. Produces compaction log entries and status reports. TRIGGER when user says "compact", "check identity sizes", "memory limits", or during reflection/session-end when files are over limit. Invoked with /compact.
---

# Compact

<!-- Trace: R600-R633, crc-CompactSkill.md, seq-compact-run.md -->

Hard character limits on identity files with intelligent LLM-assisted consolidation. Prevents unbounded growth by rewriting at higher information density, not by deleting.

## Usage

```
/compact                     -- check all files, compact any over limit
/compact preferences.md      -- compact a specific file
/compact --dry-run            -- show what would change without writing
/compact --status             -- show current sizes vs limits
```

## How It Works

### Step 1: Load Limits

Read `~/.homaruscc/config.json` field `identityLimits`. Default limits (chars):

| File | Limit |
|------|-------|
| soul.md | 8,000 |
| preferences.md | 4,000 |
| user.md | 3,000 |
| state.md | 2,000 |
| MEMORY.md | 5,000 (+ 200 lines) |
| disagreements.md | 1,500 |
| bisociations.md | 3,000 |

Identity files live at `~/.homaruscc/identity/`. MEMORY.md lives at the project root.

### Step 2: Measure Files

Read each file. Count characters. For `--status`, display a table:

```
File               Chars   Limit    Pct    Status
soul.md            7,200   8,000    90%    OK
preferences.md     4,800   4,000   120%    OVER - needs compaction
user.md            4,500   3,000   150%    OVER - flagged for human review
...
```

Mark 100-110% as WARNING, >110% as OVER. Stop here if `--status`.

### Step 3: Identify Targets

- Files >110% of limit: add to compaction queue
- Files 100-110%: log warning, skip (buffer zone)
- `user.md`: NEVER auto-compact. If over limit, say: "user.md is over limit ({pct}%). This file requires human review -- I won't compact it automatically."

### Step 4: Compact Each File

For each file in the queue, read its content and build a consolidation prompt using the per-file rules below. The LLM output IS the compacted content.

If `--dry-run`: show the proposed compacted version and character savings. Do not write.

Otherwise: write the compacted content back to the file.

### Step 5: Log

Append one JSON line per compacted file to `~/.homaruscc/compaction-log.jsonl`:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","file":"<name>","charsBefore":<n>,"charsAfter":<n>,"trigger":"<manual|auto|reflection>","dryRun":<bool>}' >> ~/.homaruscc/compaction-log.jsonl
```

## Per-File Consolidation Rules

### soul.md
Split at the `## Self-Evolution` heading. Everything ABOVE it is the **protected section** -- copy it verbatim into the output. Only consolidate the Self-Evolution section: merge similar voice notes, combine overlapping learned patterns, tighten convictions to their essence.

### preferences.md
Group entries by theme (communication, workflow, tools, aesthetics). Merge entries that say the same thing differently. Drop preferences that have been graduated into soul.md convictions. Prioritize corrections (things Max explicitly corrected) over general observations. Preserve the date of each preference's first observation.

### state.md
Keep only the latest session entry. Drop previous session summaries -- they belong in the journal, not state. Rarely needs compaction.

### MEMORY.md
Drop entries referencing files or features that no longer exist. Merge entries about the same topic into a single consolidated entry. Enforce 200-line hard limit. Keep the most operationally relevant information (bugs fixed, API quirks, architecture decisions).

### disagreements.md
When over 20 entries, consolidate into pattern groups: "Disagreements about X (N occurrences)" with 2-3 representative examples per pattern. Drop one-off disagreements older than 60 days unless they established an ongoing boundary.

### bisociations.md
Merge clusters that overlap conceptually. Drop associations that reference stale or removed features. Keep the strongest (most frequently reinforced) connections.

## Consolidation Prompt Template

When compacting a file, use this prompt structure:

```
You are consolidating an identity file. Rewrite the content below at higher information
density while preserving ALL factual information. Do not delete knowledge -- compress
presentation. The result must be under {limit} characters.

File: {filename}
Current size: {chars} chars
Target: under {limit} chars

Rules for this file:
{per_file_rules}

Current content:
---
{content}
---

Write the consolidated version. Output ONLY the file content, no wrapper or explanation.
```

## Integration

This skill is called from two places in the homaruscc SKILL.md:

**Reflection (after identity file writes):** After writing to any identity file during reflection, check that file's size against its limit. If >110%, run `/compact <file>`.

**Session-end:** Before the final state.md write, run `/compact --status`. If any file is >110%, run `/compact` on those files.

These hooks ensure compaction happens organically without a separate monitoring process.
