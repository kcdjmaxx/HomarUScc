# Requirements: Hard Memory Limits with Intelligent Compaction

## Feature: Character Limits
**Source:** specs/compact-prd.md (Character Limits)

- **R600:** Each identity file shall have a configurable character limit defined in `~/.homaruscc/config.json` under `identityLimits`
- **R601:** Default limits shall be: soul.md=8000, preferences.md=4000, user.md=3000, state.md=2000, MEMORY.md=5000, disagreements.md=1500, bisociations.md=3000
- **R602:** Limits shall be measured in characters (not bytes or lines), except MEMORY.md which also enforces a 200-line limit
- **R603:** (inferred) The system shall read limits from config at runtime; changing config values changes limits without code changes

## Feature: Compaction Logic
**Source:** specs/compact-prd.md (Per-File Rules, Consolidation)

- **R604:** Compaction shall use LLM-assisted consolidation — rewriting content at higher information density, not deleting entries
- **R605:** soul.md compaction shall never modify the protected section (above the Self-Evolution line); only the Self-Evolution section is compactable
- **R606:** preferences.md compaction shall group entries by theme, merge similar entries, drop stale/graduated preferences, and prioritize corrections over general preferences
- **R607:** user.md shall never be auto-compacted; the system shall flag it for human review when over limit
- **R608:** state.md compaction shall retain only the latest session data; it rarely needs compaction
- **R609:** MEMORY.md compaction shall drop entries for deleted/moved files, merge same-topic entries, and stay under 200 lines
- **R610:** disagreements.md compaction shall consolidate entries into patterns with 2-3 representative examples each, triggered after 20+ entries
- **R611:** bisociations.md compaction shall merge related clusters and drop stale associations
- **R612:** (inferred) The consolidation prompt shall include the file's current content and the per-file rules so the LLM can make informed decisions

## Feature: Trigger Mechanism
**Source:** specs/compact-prd.md (Trigger, Buffer Zone)

- **R613:** The system shall check file sizes after identity file writes during the event loop
- **R614:** The system shall check file sizes during daily reflection
- **R615:** A 10% buffer zone shall apply: files between 100% and 110% of limit trigger a warning but not automatic compaction
- **R616:** Files exceeding 110% of limit shall trigger automatic compaction
- **R617:** (inferred) The warning shall be logged but not block the current operation

## Feature: Logging
**Source:** specs/compact-prd.md (Auditability)

- **R618:** Each compaction event shall be appended to `~/.homaruscc/compaction-log.jsonl`
- **R619:** Log entries shall include: timestamp, filename, charsBefore, charsAfter, entriesMerged, entriesRemoved, trigger (manual/auto/reflection), and dryRun flag
- **R620:** (inferred) Dry-run operations shall be logged with dryRun=true but shall not modify any files

## Feature: Slash Commands
**Source:** specs/compact-prd.md (Usage)

- **R621:** `/compact` with no arguments shall check all identity files and compact any over limit
- **R622:** `/compact <filename>` shall compact only the specified identity file
- **R623:** `/compact --dry-run` shall show what would change without modifying files
- **R624:** `/compact --status` shall display each file's current size, limit, and percentage used
- **R625:** (inferred) Status output shall visually indicate files in the warning zone (100-110%) and danger zone (>110%)

## Feature: Integration
**Source:** specs/compact-prd.md (Trigger, Integration)

- **R626:** The homaruscc SKILL.md reflection step shall check identity file sizes after writes
- **R627:** The homaruscc SKILL.md session-end step shall check identity file sizes before final state write
- **R628:** (inferred) Integration hooks shall invoke `/compact` only when files exceed the buffer zone threshold (110%)

## Feature: Constraints
**Source:** specs/compact-prd.md (Implementation Boundary)

- **R629:** The feature shall be implemented entirely in the skill layer (SKILL.md); no new backend TypeScript code
- **R630:** The feature shall use existing tools only: Read (file sizes), Write (compacted content), Bash (logging)
- **R631:** user.md shall never be automatically compacted under any circumstances (R607 restated as constraint)
- **R632:** soul.md protected section shall never be modified under any circumstances (R605 restated as constraint)
- **R633:** (inferred) Compaction shall preserve all factual information; it consolidates presentation, not deletes knowledge
