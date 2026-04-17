# Requirements: Auto-Skill Generation

## Feature: Detection Heuristics
**Source:** specs/auto-skill-generation-prd.md (Detection Heuristics)

- **R500:** The system shall detect a skill candidate when a completed workflow involved 5+ tool calls in sequence toward a single goal (H1: Complexity Threshold)
- **R501:** The system shall detect a skill candidate when memory_search for the procedure's keywords returns 2+ existing `local/howto/*` entries describing similar steps (H2: Recurrence Signal)
- **R502:** The system shall detect a skill candidate when the user explicitly requests skill creation (e.g., "make this a skill", "save this as a command") (H3: User Request)
- **R503:** The system shall detect a skill candidate during post-event reflection when a new howto memory matches an existing howto with >0.7 similarity (H4: Reflection Trigger)
- **R504:** (inferred) Detection shall evaluate heuristics independently; any single heuristic match is sufficient to flag a candidate

## Feature: User Interaction
**Source:** specs/auto-skill-generation-prd.md (User Interaction Model)

- **R505:** The system shall never auto-create a skill without user confirmation
- **R506:** In automatic mode (default), the system shall detect a candidate and prompt the user for approval before generating
- **R507:** In explicit mode, the user requests skill creation directly and the system extracts, previews, then writes on approval
- **R508:** (inferred) The system shall present the proposed skill name and a summary of what it does before asking for confirmation

## Feature: Procedure Extraction
**Source:** specs/auto-skill-generation-prd.md (Generation Pipeline, Step 1)

- **R509:** The system shall extract from the completed workflow: name, trigger phrases, inputs, steps, outputs, and gotchas
- **R510:** (inferred) Extraction shall derive procedure steps from the actual tool calls and their parameters in the completed workflow

## Feature: SKILL.md Generation
**Source:** specs/auto-skill-generation-prd.md (Generation Pipeline, Step 2)

- **R511:** The generated SKILL.md shall include frontmatter with name and description fields
- **R512:** The generated SKILL.md shall include a usage section with trigger phrases
- **R513:** The generated SKILL.md shall include a how-it-works section with numbered steps
- **R514:** The generated SKILL.md shall include a gotchas section
- **R515:** The generated SKILL.md shall include an Origin section referencing the source howto or session
- **R516:** The description shall follow agent-first format (describes what the skill does for the agent)
- **R517:** The total SKILL.md shall be under 150 lines
- **R518:** Steps shall reference specific tool names and parameter patterns used in the original workflow
- **R519:** The generated SKILL.md shall not contain speculative features beyond what was observed in the source procedure

## Feature: Validation
**Source:** specs/auto-skill-generation-prd.md (Generation Pipeline, Step 3)

- **R520:** Before writing, the system shall check that `.claude/skills/<name>/` does not already exist
- **R521:** If the skill directory already exists, the system shall show both versions and ask the user how to proceed
- **R522:** Before writing, the system shall verify the new skill's description does not collide with existing skill trigger phrases

## Feature: Write and Register
**Source:** specs/auto-skill-generation-prd.md (Generation Pipeline, Step 4)

- **R523:** The system shall create the directory `.claude/skills/<name>/`
- **R524:** The system shall write the generated content to `.claude/skills/<name>/SKILL.md`
- **R525:** The system shall log the skill creation to the memory system via memory_store
- **R526:** The system shall notify the user that the skill was created and will activate on next CC restart

## Feature: Usage Tracking
**Source:** specs/auto-skill-generation-prd.md (Generation Pipeline, Step 5; Data Model)

- **R527:** The system shall increment a trigger count each time a generated skill is invoked
- **R528:** The system shall flag skills with 0 triggers after 30 days as unused
- **R529:** (inferred) The system shall not automatically delete unused skills; flagging is informational only

## Feature: Data Model
**Source:** specs/auto-skill-generation-prd.md (Data Model)

- **R530:** Skill candidate records shall be stored at `~/.homaruscc/auto-skills.json`
- **R531:** Each candidate record shall include: name, detectedAt, detection heuristic, sourceHowto, toolCallCount, status (pending/approved/declined/written), skillPath, triggerCount, and lastTriggered
- **R532:** An append-only event log shall be maintained at `~/.homaruscc/auto-skills-log.jsonl`
- **R533:** (inferred) The status field shall transition: pending -> approved/declined, and approved -> written

## Feature: Configuration
**Source:** specs/auto-skill-generation-prd.md (Implementation Approach)

- **R534:** An `autoSkill` section shall be added to `~/.homaruscc/config.json` for feature configuration
- **R535:** (inferred) The autoSkill config shall include an enabled flag to turn detection on or off

## Feature: Integration with Reflection
**Source:** specs/auto-skill-generation-prd.md (Integration Points; Implementation Approach)

- **R536:** Skill detection shall run during the /homaruscc event loop's reflection step (step 4: procedural narration)
- **R537:** The auto-skill feature shall be implemented as a new skill at `.claude/skills/auto-skill/SKILL.md`
- **R538:** (inferred) The homaruscc SKILL.md reflection step shall be updated to invoke auto-skill detection when a howto memory is being written

## Feature: Implementation Boundary
**Source:** specs/auto-skill-generation-prd.md (Implementation Approach)

- **R539:** The MVP shall require no new backend TypeScript code; it shall use existing memory_search and memory_store tools
- **R540:** (inferred) The feature shall work entirely within the skill layer (SKILL.md files) and config, not as a compiled backend module
