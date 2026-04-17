# Requirements: Build Skill (GSD + Mini-spec Hybrid)

## Feature: Build Skill Core
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R1:** The build skill shall execute each mini-spec phase in a fresh context, preventing cross-phase context accumulation
- **R2:** The build skill shall support three execution modes: step (one phase, pause), auto (all phases, no pause), and quick (abbreviated pipeline)
- **R3:** Each fresh context shall receive only the artifacts relevant to its phase, as defined in the injection table in the PRD
- **R4:** Artifacts not relevant to the current phase shall not be injected into the context

## Feature: Slash Commands
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R5:** `/build` shall analyze current project state and execute the next phase in step mode
- **R6:** `/build auto` shall execute all remaining phases sequentially without user intervention
- **R7:** `/build:quick` shall run Requirements -> Design -> Implementation -> Simplify, skipping Refs, Specs, Review, and Gaps
- **R8:** `/build:init` shall create the `.build/` directory with STATE.md, config.json, and slices/ subdirectory
- **R9:** `/build:status` shall display current phase, progress checklist, warnings, and next steps
- **R10:** `/build:resume` shall resume execution from the last completed slice after a crash or interruption
- **R11:** `/build:slice <n>` shall re-run a specific slice by number
- **R12:** `/build:plan` shall run only planning phases (Refs through Design) and stop before Implementation
- **R13:** `/build:execute` shall run only execution phases (Implementation + Simplify), requiring design artifacts to exist
- **R14:** `/build:review` shall run only review phases (Review + Gaps)

## Feature: STATE.md Cross-Session Memory
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R15:** STATE.md shall be read at the start and written at the end of every phase
- **R16:** STATE.md shall track: current phase/slice, progress checklist, decisions, blockers, context budget, and warnings
- **R17:** Each decision shall be numbered (D1, D2, ...) and include a one-line rationale
- **R18:** Each warning shall be numbered (W1, W2, ...) and reference the phase that generated it
- **R19:** Progress entries shall use checkbox format matching the slice plan

## Feature: Directory Structure
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R20:** The build skill shall create a `.build/` directory at the project root
- **R21:** `.build/` shall contain STATE.md, STRUCTURE.md, config.json, slices/, and history/
- **R22:** STRUCTURE.md shall be auto-generated at the start of each session with the current directory layout
- **R23:** Slice plans shall be numbered markdown files in `.build/slices/` describing each phase's scope and inputs
- **R24:** Session history shall be logged to `.build/history/YYYY-MM-DD-session.md` after each session

## Feature: Implementation Slicing
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R25:** The Implementation phase shall be subdivided into slices, one per logical file group
- **R26:** Slice boundaries shall be determined by the Design phase output (CRC card to code file mappings)
- **R27:** Each implementation slice shall receive only its relevant CRC cards, sequence diagrams, requirements.md, and target source files
- **R28:** Implementation slices shall not receive other CRC cards, spec files, or previous slice output beyond committed code

## Feature: Traceability Preservation
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R29:** The build skill shall maintain the full traceability chain: spec item -> requirement (Rn) -> design artifact -> code comment
- **R30:** The minispec CLI tool shall be invoked for all checkbox operations (check, uncheck) and requirement reference operations (add-ref, remove-ref)
- **R31:** `minispec validate` shall be run at the end of each relevant phase to catch traceability breaks immediately
- **R32:** Artifacts checkboxes in design.md shall be unchecked before code modification and re-checked after implementation matches design
- **R33:** Code traceability comments (`// CRC: ... | Seq: ...`) shall be added during implementation slices

## Feature: Auto Mode Behavior
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R34:** In auto mode, warnings from a phase shall be logged to STATE.md and execution shall continue
- **R35:** In auto mode, validation failures (minispec phase validation errors) shall halt execution and report the failure
- **R36:** In auto mode, the build skill shall check for blocking issues between phases before proceeding

## Feature: HomarUScc Integration
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R37:** (inferred) Implementation slices may be dispatched as background agents via HomarUScc's agent registry for parallel execution
- **R38:** (inferred) `.build/STATE.md` shall be indexed by the memory system for future searchability
- **R39:** (inferred) Build progress shall be reportable via the HomarUScc dashboard event bus
- **R40:** (inferred) Long-running auto-mode builds may register a timer to notify the user via Telegram on completion or blocker

## Feature: Migration
**Source:** specs/gsd-minispec-hybrid-prd.md

- **R41:** The build skill shall read existing specs/, design/, and refs/ directories produced by mini-spec without modification
- **R42:** The minispec CLI tool shall work identically with both /mini-spec and /build skills
- **R43:** Existing projects shall gain /build support by running `/build:init` with no other changes required
- **R44:** (inferred) The /mini-spec skill shall remain functional during the coexistence period
