# CompactSkill (skill prompt logic)
**Requirements:** R600-R633

## Knows
- identityLimits: per-file character limits from config.json (R600, R601)
- identityDir: `~/.homaruscc/identity/` for soul.md, preferences.md, user.md, state.md, disagreements.md, bisociations.md
- memoryMdPath: project MEMORY.md path
- bufferZone: 10% over limit = warn only; >110% = compact (R615, R616)
- perFileRules: consolidation strategy per file (R605-R611)
- compactionLogPath: `~/.homaruscc/compaction-log.jsonl` (R618)
- protectedFiles: user.md (never auto-compact), soul.md protected section (never touch) (R607, R632)

## Does
- checkStatus(): statusReport -- Reads all identity files, compares char count to limit, returns table with size/limit/percentage (R624)
- identifyOverLimit(): file[] -- Filters files exceeding 110% of limit; returns list needing compaction (R616)
- buildConsolidationPrompt(file, content, rules): string -- Constructs LLM prompt with file content and per-file rules (R604, R612)
- compact(file, dryRun?): result -- Reads file, generates consolidated version via LLM, writes back if not dry-run, logs to JSONL (R604, R618-R620)
- compactAll(dryRun?): results[] -- Iterates all files, compacts those over limit, skips user.md (R621, R631)
- logCompaction(entry): void -- Appends JSON line to compaction-log.jsonl (R618, R619)
- warnBufferZone(file, pct): void -- Logs warning for files between 100-110% (R615, R617)

## Collaborators
- Read tool: measures file character counts, reads current content
- Write tool: writes compacted content back to identity files
- Bash tool: appends to compaction-log.jsonl
- homaruscc SKILL.md: invoked during reflection (R626) and session-end (R627)
- config.json: reads identityLimits section (R600, R603)

## Sequences
- seq-compact-run.md

## Notes
This is a prompt CRC -- the logic lives in `.claude/skills/compact/SKILL.md` as instructions
for Claude Code, not as TypeScript. Compaction runs on-demand via `/compact` or automatically
when triggered by reflection/session-end hooks in homaruscc SKILL.md.
