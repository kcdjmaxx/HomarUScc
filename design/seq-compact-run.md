# Sequence: Compaction Run

**Requirements:** R600, R604-R607, R609-R611, R613-R620, R621-R625, R629-R633

## Trigger
User invokes `/compact`, `/compact <file>`, `/compact --status`, or `/compact --dry-run`.
Also triggered automatically by reflection or session-end hooks when files exceed 110% of limit.

## Sequence

```
Invocation (manual or hook)
  |
  v
Read identityLimits from ~/.homaruscc/config.json (R600, R603)
  |
  v
Read all identity files, measure char counts (R602)
  |-- ~/.homaruscc/identity/soul.md
  |-- ~/.homaruscc/identity/preferences.md
  |-- ~/.homaruscc/identity/user.md
  |-- ~/.homaruscc/identity/state.md
  |-- ~/.homaruscc/identity/disagreements.md
  |-- ~/.homaruscc/identity/bisociations.md
  |-- MEMORY.md (project root)
  |
  v
--status? → Display table: file | chars | limit | pct | status → DONE (R624, R625)
  |
  v
Identify over-limit files (R615, R616)
  |-- 100-110%: log warning, skip compaction (R615, R617)
  |-- >110%: add to compaction queue
  |-- user.md: ALWAYS skip, flag for human review if over (R607, R631)
  |
  v
For each file in compaction queue:
  |
  +-- soul.md? (R605, R632)
  |     |-- Split at Self-Evolution line
  |     |-- Protected section: preserve verbatim
  |     |-- Self-Evolution section: build consolidation prompt
  |
  +-- preferences.md? (R606)
  |     |-- Prompt: group by theme, merge similar, drop stale, prioritize corrections
  |
  +-- MEMORY.md? (R609)
  |     |-- Prompt: drop entries for deleted files, merge same-topic, enforce 200-line limit
  |
  +-- disagreements.md? (R610)
  |     |-- Prompt: consolidate into patterns with 2-3 examples each
  |
  +-- bisociations.md? (R611)
  |     |-- Prompt: merge related clusters, drop stale associations
  |
  +-- state.md? (R608)
  |     |-- Prompt: retain latest session only
  |
  v
Build consolidation prompt with file content + per-file rules (R604, R612)
  |
  v
--dry-run? → Show proposed changes, log with dryRun=true → DONE (R620, R623)
  |
  v
Write compacted content back to file (R604)
  |
  v
Log compaction to ~/.homaruscc/compaction-log.jsonl (R618, R619)
  |-- { ts, file, charsBefore, charsAfter, entriesMerged, entriesRemoved, trigger, dryRun }
  |
  v
Report results: files compacted, chars saved, any warnings
```

## Notes

- When triggered by hooks (reflection/session-end), only files >110% are compacted (R616, R628).
- Manual `/compact <file>` compacts the specified file regardless of buffer zone.
- The consolidation prompt is the core logic -- it instructs Claude to rewrite at higher density while preserving all factual content (R633).
- No backend TypeScript code involved; all logic is in the SKILL.md prompt (R629).
