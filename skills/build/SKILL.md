---
name: build
description: Phased build pipeline with fresh-context-per-phase execution. Produces design artifacts (CRC cards, sequences, requirements) and traced source code in .build/ directory. TRIGGER when user says "build this feature", "implement", "create a new module", "build using mini-spec", or wants a structured multi-phase development workflow. Invoked with /build.
---

# Build

Hybrid methodology combining mini-spec artifact traceability with GSD fresh-context-per-phase execution. Each phase runs in an isolated agent context, receiving only the artifacts it needs. Structured files (STATE.md, requirements.md, CRC cards) are the sole cross-phase communication channel.

## Usage

```
/build              Step mode: execute next phase, pause, report
/build auto         Auto mode: run all remaining phases without stopping
/build:quick        Quick mode: Req -> Design -> Impl -> Simplify (skip Refs/Specs/Review/Gaps)
/build:init         Initialize .build/ directory and STATE.md
/build:status       Show current phase, progress, and next steps
/build:resume       Resume from last checkpoint after crash or interruption
/build:plan         Run planning phases only (Refs through Design)
/build:execute      Run execution phases only (Impl + Simplify), requires design to exist
/build:review       Run review phases only (Review + Gaps)
```

## Slash Command Router

| Input | Action |
|---|---|
| `/build` (no args) | Go to **Step Mode Execution** |
| `/build auto` | Go to **Auto Mode Execution** |
| `/build:quick` | Go to **Quick Mode Execution** |
| `/build:init` | Go to **Initialize Build Directory** |
| `/build:status` | Go to **Status Report** |
| `/build:resume` | Go to **Resume Execution** |
| `/build:plan` | Run step mode but stop after phase 4 (Design) |
| `/build:execute` | Verify design exists, then run phases 5-6 only |
| `/build:review` | Run phases 6b-7 only |

---

## Prerequisite

Run `~/.claude/bin/minispec query comment-patterns` to verify installation. If it fails, tell the user the minispec CLI is required and stop.

---

## Phase Table

| # | Phase | Prompt File | GSD Role |
|---|---|---|---|
| 1 | refs | `prompts/phase-refs.md` | PLAN |
| 2 | specs | `prompts/phase-specs.md` | PLAN |
| 3 | requirements | `prompts/phase-requirements.md` | PLAN |
| 4 | design | `prompts/phase-design.md` | PLAN |
| 5 | implementation | `prompts/phase-implement.md` | EXECUTE |
| 6 | simplify | `prompts/phase-simplify.md` | EXECUTE |
| 6b | review | `prompts/phase-review.md` | REVIEW |
| 7 | gaps | `prompts/phase-gaps.md` | REVIEW |
| 8 | docs | `prompts/phase-docs.md` | (optional) |
| 9 | compound | `prompts/phase-compound.md` | (optional) |

Injection rules, slicing algorithm, STATE.md management, traceability enforcement, error handling, and integration notes are all in `reference.md`.

---

## Phase Execution via Agent Tool

For each phase:

1. **Pre-phase:** Read STATE.md, regenerate STRUCTURE.md, read injection files per `reference.md` injection table
2. **Dispatch:** Read the phase prompt from the corresponding `prompts/phase-*.md` file. Replace `<inject:...>` placeholders with actual file contents. Call Agent tool with the assembled prompt.
3. **Post-phase:** Read updated STATE.md, run `~/.claude/bin/minispec phase <phase_name>`, update progress

---

## Initialize Build Directory

**Triggered by:** `/build:init`, or automatically on first `/build` if `.build/` does not exist.

Create: `.build/` with `STATE.md`, `config.json`, `STRUCTURE.md`, `slices/`, `history/`.

### STATE.md Template

```markdown
# Build State

## Current
- **Phase:** init
- **Slice:** --
- **Status:** initialized
- **Feature:** <ask user or infer from specs/>
- **Started:** <ISO 8601 timestamp>

## Progress
(populated after planning)

## Decisions
(none yet)

## Blockers
(none)

## Context Budget
(tracked per phase)

## Warnings
(none)
```

### config.json Template

```json
{
  "maxConcurrentSlices": 5,
  "executionMode": "step",
  "feature": "",
  "projectRoot": "<absolute path>",
  "createdAt": "<ISO 8601>"
}
```

### STRUCTURE.md

Auto-generate by listing the project directory tree (excluding node_modules, dist, .git, .build). Regenerate at the start of every phase.

After initialization, display the created structure and ask the user what feature they want to build (unless already clear from context).

---

## Status Report

**Triggered by:** `/build:status`

1. Read `.build/STATE.md`
2. Read `design/design.md` Artifacts section (if it exists)
3. Run `~/.claude/bin/minispec query artifacts` (if design exists)
4. Display: current phase/slice, progress checklist, blockers/warnings, next action, artifact coverage

---

## Resume Execution

**Triggered by:** `/build:resume`

1. Read `.build/STATE.md` to find the last completed slice
2. Determine the next incomplete slice from the Progress section
3. Update status to `in-progress` for that slice
4. Execute it using the appropriate phase runner

If STATE.md shows no incomplete slices, report that the build is complete.

---

## Step Mode Execution

**Triggered by:** `/build` (no args)

1. Check if `.build/` exists. If not, run **Initialize Build Directory** first.
2. Read `.build/STATE.md` to determine the current phase.
3. Determine the next incomplete phase from the Progress section.
4. Read the injection files for that phase (per `reference.md` injection table).
5. Regenerate `.build/STRUCTURE.md`.
6. Read the prompt from the phase's `prompts/phase-*.md` file, assemble with injected content.
7. Dispatch phase via Agent tool.
8. After completion: read STATE.md, run validation, report results, show next phase, wait for user.

---

## Auto Mode Execution

**Triggered by:** `/build auto`

Same as step mode but loops through all remaining phases without stopping. **Stops on:** blockers in STATE.md or phase validation failure. **Continues through:** warnings and uncovered requirements (addressed in Gaps phase). After all phases: write session summary to `.build/history/`, report final status.

---

## Quick Mode Execution

**Triggered by:** `/build:quick`

Abbreviated pipeline: skip phases 1-2, run 3 (if no requirements.md), then 4, 5, 6. Skip 6b, 7, 8, 9. Still enforces: numbered requirements, CRC cards with Requirements headers, traceability comments, artifact checkboxes.

---

## Companion Files

| File | Contents |
|---|---|
| `prompts/phase-refs.md` | Reference collection agent prompt |
| `prompts/phase-specs.md` | Spec writing agent prompt |
| `prompts/phase-requirements.md` | Requirements extraction agent prompt |
| `prompts/phase-design.md` | Design agent prompt + slicing plan output |
| `prompts/phase-implement.md` | Implementation agent prompt + concurrency rules |
| `prompts/phase-simplify.md` | Simplification agent prompt |
| `prompts/phase-review.md` | Multi-agent review prompt |
| `prompts/phase-gaps.md` | Gap analysis agent prompt |
| `prompts/phase-docs.md` | Documentation agent prompt |
| `prompts/phase-compound.md` | Compound/learnings agent prompt |
| `reference.md` | Injection rules, slicing algorithm, STATE.md management, traceability, error handling, integration |
