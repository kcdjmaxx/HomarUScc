---
name: auto-skill
description: Detect reusable procedures and generate SKILL.md files. Runs automatically during reflection (when autoSkill.enabled) to flag complex or recurring workflows, or on-demand when user says "make this a skill". Produces a new .claude/skills/<name>/SKILL.md and tracks candidates in ~/.homaruscc/auto-skills.json. TRIGGER when user says "make this a skill", "save this as a command", "turn this into a skill", or during reflection when a howto memory matches detection heuristics. Invoked with /auto-skill.
---

<!-- Traceability: crc-AutoSkillDetector.md, crc-AutoSkillGenerator.md, crc-AutoSkillTracker.md, seq-auto-skill-detect.md, seq-auto-skill-generate.md, seq-auto-skill-explicit.md -->

# Auto-Skill

Detect when a workflow you just completed is reusable enough to become a skill, then generate a SKILL.md for it. Works in two modes: automatic detection during reflection, or explicit creation when the user asks.

## Usage

```
/auto-skill                      -- detect skill candidates from recent session
/auto-skill <name>               -- create a skill from a specific recent procedure
"make this a skill"              -- explicit trigger (H3), works even if autoSkill.enabled is false
```

## How It Works

### Mode A: Automatic Detection (During Reflection)

This runs during the homaruscc event loop reflection step 4, after a `local/howto/*` memory has been stored.

#### Step 1: Check Config

Read `~/.homaruscc/config.json`. If `autoSkill.enabled` is not `true`, skip detection entirely. If the key is missing or false, stop here and continue the event loop normally.

#### Step 2: Run Detection Heuristics

Evaluate each heuristic independently. Any single match is sufficient to flag a candidate.

**H1 -- Complexity Threshold (R500):**
Count the tool calls from the current workflow. If 5 or more tool calls were made toward a single goal, this is a candidate.

**H2 -- Recurrence Signal (R501):**
Search memory for existing howtos with keywords from the new howto:

```
memory_search: query="<keywords from new howto>" filter="local/howto/*"
```

If 2 or more existing `local/howto/*` entries match, this is a candidate.

**H4 -- Reflection Similarity (R503):**
Search memory using the full text of the new howto:

```
memory_search: query="<full howto text>"
```

If the top result has >0.7 similarity score AND is a different memory key, this is a candidate.

Note: H3 (explicit request) is handled by Mode B below, not here.

#### Step 3: Evaluate Results

If no heuristic matched, continue the event loop -- no candidate.

If any matched, build a candidate record and proceed to Step 4.

#### Step 4: Track the Candidate

Read `~/.homaruscc/auto-skills.json` (create as `[]` if missing). Append a new candidate record:

```json
{
  "name": "<derived-skill-name>",
  "detectedAt": "<ISO-8601 timestamp>",
  "detection": "H1|H2|H4",
  "sourceHowto": "<memory key of the triggering howto>",
  "toolCallCount": 7,
  "status": "pending",
  "skillPath": ".claude/skills/<name>/SKILL.md",
  "triggerCount": 0,
  "lastTriggered": null
}
```

Write the updated array back to `~/.homaruscc/auto-skills.json`.

Append a log entry to `~/.homaruscc/auto-skills-log.jsonl`:

```json
{"event": "candidate_detected", "name": "<name>", "detection": "H1", "timestamp": "<ISO-8601>"}
```

#### Step 5: Prompt the User

Never auto-create. Always ask first:

> I noticed **<name>** could be a reusable skill. It <one-sentence summary of what it does>. Want me to create it?

- If user confirms: proceed to the Generation Pipeline below.
- If user declines: update status to `"declined"`, append log entry, continue event loop.

---

### Mode B: Explicit Creation (User-Initiated)

Triggered by H3: user says "make this a skill", "save this as a command", or similar. This works even when `autoSkill.enabled` is false.

#### Step 1: Identify the Source Procedure

Determine what to turn into a skill:
- **Option A:** The most recent workflow in the current session (review tool call history).
- **Option B:** A specific howto the user names (search memory for it).

If ambiguous, ask: "Which procedure should I capture as a skill?"

#### Step 2: Extract and Preview

Extract the procedure (see Generation Pipeline Step 1 below), then show the user:
- Proposed skill name
- Summary of what it does
- List of trigger phrases
- Draft SKILL.md content

Ask: "Does this look right? Any changes?"

The user can request name changes, step adjustments, or additional triggers before approving.

#### Step 3: Track as Approved

Add a candidate record with status `"approved"` directly (skips pending, since user initiated). Write to `auto-skills.json` and append to the JSONL log.

#### Step 4: Validate, Write, Notify

Proceed to the Generation Pipeline steps 3-5 below.

---

### Generation Pipeline

This runs after user confirmation (from either Mode A or Mode B).

#### Step 1: Extract Procedure (R509, R510)

Review the source workflow's tool calls. Extract:

| Field | Source |
|-------|--------|
| **name** | Kebab-case slug derived from the goal |
| **trigger phrases** | Natural language ways to invoke it |
| **inputs** | Parameters the user provides |
| **steps** | Ordered tool calls with their parameter patterns |
| **outputs** | What the procedure produces |
| **gotchas** | Errors encountered, edge cases, workarounds |

Derive steps from actual tool names and parameters observed in the workflow. Do not invent steps that were not performed.

#### Step 2: Generate SKILL.md (R511-R519)

Render the skill file using this template:

```markdown
---
name: <kebab-case-name>
description: <Agent-first description of what the skill does. Include TRIGGER phrases. End with "Invoked with /<name>.">
---

# <Title Case Name>

<One-line description of what this skill does and when to use it.>

## Usage

\```
/<name>                          -- <default behavior>
/<name> <arg>                    -- <with argument>
\```

## How It Works

### Step 1: <First Step>
<What to do, which tools to use, parameter patterns.>

### Step 2: <Second Step>
...

## Gotchas
- <Edge case or known issue>
- <Workaround for common error>

## Origin
Generated by auto-skill on <date> from <source reference>.
Source: <howto memory key or "current session">.
Detection: <which heuristic triggered>.
```

Verify the output:
- Under 150 lines total (R517)
- No speculative features beyond what was observed (R519)
- Steps reference specific tool names used in the original workflow (R518)
- Description is agent-first (R516): describes what the skill does for the agent, not the user

#### Step 3: Validate Uniqueness (R520-R522)

Check for directory collision:

```
Glob: .claude/skills/<name>/SKILL.md
```

If the directory already exists (R521):
- Show the user both versions (existing and proposed)
- Ask: "A skill named **<name>** already exists. Replace it, keep existing, or rename?"
- If replace: proceed. If keep: abort (status stays approved). If rename: restart with new name.

Check for trigger phrase collision (R522):
- Read all existing `SKILL.md` files in `.claude/skills/*/`
- Scan their `description` frontmatter for overlapping trigger phrases
- If collision found: warn user, ask to proceed or rename

#### Step 4: Write and Register (R523-R526)

Create the skill directory and file:

```bash
mkdir -p .claude/skills/<name>/
```

Write the generated content to `.claude/skills/<name>/SKILL.md`.

Log to the memory system:

```
memory_store:
  key: "local/skills/<name>"
  content: "Auto-generated skill: <name>. <summary>. Created <date> from <source>."
```

Update the candidate status to `"written"` in `auto-skills.json`. Append a write event to the JSONL log:

```json
{"event": "skill_written", "name": "<name>", "skillPath": ".claude/skills/<name>/SKILL.md", "timestamp": "<ISO-8601>"}
```

#### Step 5: Notify User (R526)

> Created `.claude/skills/<name>/SKILL.md`. The skill will activate on next Claude Code restart. Invoke it with `/<name>`.

---

### Usage Tracking (R527-R529)

When a generated skill is invoked, update its candidate record in `auto-skills.json`:
- Increment `triggerCount` by 1
- Set `lastTriggered` to the current ISO-8601 timestamp

During reflection, check for stale skills:
- Read `auto-skills.json`
- Any skill with status `"written"`, `triggerCount` of 0, and `detectedAt` older than 30 days is flagged
- Report stale skills to the user: "Skill **<name>** hasn't been used in 30 days. Keep or remove?"
- Never auto-delete. Flagging is informational only (R529).

## File Locations

| File | Purpose |
|------|---------|
| `~/.homaruscc/auto-skills.json` | Candidate records array |
| `~/.homaruscc/auto-skills-log.jsonl` | Append-only event log |
| `~/.homaruscc/config.json` | `autoSkill.enabled` flag |
| `.claude/skills/<name>/SKILL.md` | Generated skill output |
