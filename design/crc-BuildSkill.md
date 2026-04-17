# BuildSkill
**Requirements:** R1, R2, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14

The top-level orchestrator for the /build skill. Determines which phase to run next, dispatches it in a fresh context, and manages transitions between phases.

## Knows
- currentPhase: the active phase from STATE.md
- executionMode: "step" | "auto" | "quick"
- slicePlan: ordered list of SliceDefinition objects for the current feature
- projectRoot: absolute path to the project directory

## Does
- analyzeBuildState(): reads STATE.md and design.md to determine the next phase to execute
- runPhase(phase): dispatches a phase to a fresh context via PhaseRunner with the correct injection set
- runAuto(): loops through all remaining phases, checking for blockers between each
- runQuick(): executes the abbreviated pipeline (Req -> Design -> Impl -> Simplify)
- handleSlashCommand(command, args): routes /build, /build auto, /build:init, etc. to the correct behavior

## Collaborators
- PhaseRunner: executes a single phase in an isolated context
- StateManager: reads/writes STATE.md
- SlicePlanner: determines implementation slice boundaries from design artifacts
- MinispecCli: invokes the minispec CLI for validation and artifact operations

## Sequences
- seq-build-step.md
- seq-build-auto.md


---

# PhaseRunner
**Requirements:** R1, R3, R4, R27, R28

Executes a single mini-spec phase in an isolated context. Responsible for assembling the injection payload, spawning the context, and collecting results.

## Knows
- phase: which mini-spec phase to run (refs, specs, requirements, design, implementation, simplify, review, gaps, docs, compound)
- injectionRules: mapping of phase -> required artifacts (from the PRD injection table)
- contextBudget: token limit tracking for the current phase

## Does
- assembleInjection(phase, sliceDef?): collects the files that should be injected into this phase's context, excludes everything else
- execute(injection): spawns a fresh Claude Code subagent (or agent task) with the injection payload
- collectResults(): reads output artifacts (modified files, new files, STATE.md updates) from the completed phase
- reportTokenUsage(): logs approximate token usage to STATE.md for budget tracking

## Collaborators
- StateManager: reads STATE.md for injection, writes updates after execution
- BuildSkill: receives dispatch instructions from the orchestrator
- AgentRegistry: (optional) dispatches implementation slices as background agents

## Sequences
- seq-build-step.md


---

# StateManager
**Requirements:** R15, R16, R17, R18, R19, R22, R24

Manages the `.build/STATE.md` file -- the cross-session memory. Every phase reads state at the start and writes state at the end.

## Knows
- statePath: path to `.build/STATE.md`
- structurePath: path to `.build/STRUCTURE.md`
- historyDir: path to `.build/history/`

## Does
- readState(): parses STATE.md into a structured object (currentPhase, progress, decisions, blockers, warnings)
- writeState(updates): merges updates into STATE.md, preserving existing content
- addDecision(text): appends a numbered decision (D1, D2, ...) to the Decisions section
- addWarning(text, phase): appends a numbered warning (W1, W2, ...) with phase attribution
- addBlocker(text): appends to Blockers section; auto mode checks this before advancing
- markSliceComplete(sliceId, summary): checks off the progress entry and adds a summary note
- refreshStructure(): regenerates STRUCTURE.md from the current directory tree
- logSession(): writes session summary to history/YYYY-MM-DD-session.md

## Collaborators
- BuildSkill: called by the orchestrator between phases
- PhaseRunner: called at phase start and end

## Sequences
- seq-build-step.md
- seq-build-auto.md


---

# SlicePlanner
**Requirements:** R25, R26, R27

Analyzes the Design phase output to determine implementation slice boundaries. Each slice maps a CRC card (or group of related CRC cards) to its target source files.

## Knows
- designPath: path to design.md (Artifacts section)
- crcCards: list of CRC card files and their target code files
- sequences: list of sequence diagrams and their participant files

## Does
- planSlices(): reads design.md Artifacts section, groups CRC cards into implementation slices based on file overlap and dependency
- emitSlicePlans(): writes numbered slice plan files to `.build/slices/`
- getSlice(n): returns the SliceDefinition for slice number n
- detectConflicts(sliceA, sliceB): checks if two slices modify the same files (would require serialization)

## Collaborators
- BuildSkill: called after the Design phase to plan Implementation slices
- PhaseRunner: provides SliceDefinition objects used to assemble injection payloads

## Sequences
- seq-build-auto.md


---

# MinispecCli
**Requirements:** R30, R31, R32, R33

Wrapper around the `~/.claude/bin/minispec` CLI tool. Provides programmatic access to validation, artifact checkbox operations, and requirement references.

## Knows
- binaryPath: path to the minispec CLI (`~/.claude/bin/minispec`)
- designDir: path to the design/ directory

## Does
- validate(): runs `minispec validate` and returns structured results (pass/fail with details)
- validatePhase(phase): runs `minispec phase <phase>` for phase-specific validation
- checkArtifact(designFile, artifactFile): marks an artifact checkbox as checked
- uncheckArtifact(designFile, artifactFile): marks an artifact checkbox as unchecked
- addRef(crcFile, requirementId): adds a requirement reference to a CRC card
- queryArtifacts(): returns current artifact states
- queryUncovered(): returns requirements without design coverage

## Collaborators
- PhaseRunner: called during and after phase execution for validation
- BuildSkill: called for status queries

## Sequences
- seq-build-step.md


---

# BuildConfig
**Requirements:** R8, R20, R21

Manages the `.build/config.json` file and the initialization of the `.build/` directory structure.

## Knows
- configPath: path to `.build/config.json`
- defaults: default configuration values (auto-mode timeout, slice parallelism, notification preferences)

## Does
- init(): creates `.build/` directory with STATE.md, config.json, STRUCTURE.md, slices/, and history/
- readConfig(): parses config.json
- writeConfig(updates): merges updates into config.json
- isInitialized(): checks if `.build/` directory exists and is valid

## Collaborators
- BuildSkill: called by /build:init and checked at the start of every /build invocation
- StateManager: init() creates the initial empty STATE.md

## Sequences
- seq-build-step.md
