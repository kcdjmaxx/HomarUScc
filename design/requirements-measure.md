# Requirements: Measure Skill

## Feature: Memory Retrieval Quality (M1)
**Source:** specs/measure-skill PRD, section M1

- **R550:** The measure skill shall maintain a golden test set of query/expected-result pairs at `~/.homaruscc/metrics/memory-golden.json`
- **R551:** The golden test set shall contain at least 20 test cases seeded from actual usage queries
- **R552:** Each golden test case shall include a query string, one or more expected result keys, and an optional category tag
- **R553:** The skill shall run each golden query against `memory_search` and record whether the expected result appears in the top-N results (default N=5)
- **R554:** The skill shall report hit rate (percentage of queries where expected result appears in top-N), mean rank position, and a list of worst performers (missed or low-ranked)
- **R555:** Memory test results shall be appended to `~/.homaruscc/metrics/memory-results.jsonl` with a timestamp for historical tracking
- **R556:** `/measure --add-golden` shall interactively add a new test case to the golden test set [inferred]

## Feature: Skill Usage Tracking (M2)
**Source:** specs/measure-skill PRD, section M2

- **R557:** The skill shall count skill invocations by parsing session transcripts and `auto-skills.json`
- **R558:** The skill shall report most-used skills, never-used skills, and trending skills (usage change over recent periods)
- **R559:** Skill usage data shall be written to `~/.homaruscc/metrics/skill-usage.json` with a timestamp

## Feature: Event Loop Health (M3)
**Source:** specs/measure-skill PRD, section M3

- **R560:** The skill shall collect uptime, compaction count, and event handling data from the status API and journal files
- **R561:** The skill shall report average session length, compactions per session, and events per hour
- **R562:** Event loop health data shall be written to `~/.homaruscc/metrics/event-loop-health.json` with a timestamp

## Feature: Prediction Error Patterns (M4)
**Source:** specs/measure-skill PRD, section M4

- **R563:** The skill shall parse `~/.homaruscc/prediction-errors.jsonl` and group entries by domain and severity
- **R564:** The skill shall report most common error domains, trends over time, and recent lessons
- **R565:** Prediction error summary shall be written to `~/.homaruscc/metrics/prediction-summary.json` with a timestamp

## Feature: Slash Command Interface
**Source:** specs/measure-skill PRD, Usage section

- **R566:** `/measure` with no arguments shall run all four MVP measurements (M1-M4) sequentially
- **R567:** `/measure memory` shall run only the memory retrieval quality measurement (M1)
- **R568:** `/measure skills` shall run only the skill usage measurement (M2)
- **R569:** `/measure health` shall run only the event loop health measurement (M3)
- **R570:** `/measure errors` shall run only the prediction error measurement (M4)
- **R571:** `/measure --add-golden` shall prompt for query, expected results, and category, then append to the golden test set
- **R572:** `/measure --history` shall display trend data from historical JSON files, showing changes over time

## Feature: Output and Reporting
**Source:** specs/measure-skill PRD, Output section

- **R573:** Each measurement shall write structured JSON to its respective file under `~/.homaruscc/metrics/`
- **R574:** After all requested measurements complete, the skill shall generate a human-readable summary report at `~/.homaruscc/metrics/report-latest.md`
- **R575:** The report shall be structured so other skills can parse the JSON files programmatically [inferred]
- **R576:** The `~/.homaruscc/metrics/` directory shall be created automatically if it does not exist [inferred]

## Feature: Integration
**Source:** specs/measure-skill PRD, Integration section

- **R577:** A weekly timer (Sunday evening) shall trigger a full `/measure` run [inferred]
- **R578:** The measure skill shall be invocable as a post-build regression check by other skills [inferred]
- **R579:** The measure skill shall support pre-optimization baseline establishment by storing timestamped snapshots [inferred]

## Feature: Implementation Constraints
**Source:** specs/measure-skill PRD, Implementation section

- **R580:** The measure skill shall be implemented entirely as a skill-layer file at `.claude/skills/measure/SKILL.md` with no new backend TypeScript code
- **R581:** The skill shall use only existing tools: `memory_search`, `get_status`, and file read/write operations
- **R582:** All metric data files shall use JSON or JSONL format for machine readability [inferred]

## Post-MVP (deferred, not in scope)
- **R590:** M5 — Tool call success rates (requires new `/api/tool-stats` endpoint)
- **R591:** M6 — Compaction continuity score (requires pre/post-compaction self-test)
