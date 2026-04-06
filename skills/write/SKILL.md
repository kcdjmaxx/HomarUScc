---
name: write
description: Multi-step writing workflow that produces polished long-form articles. Outputs a markdown article file through research, outline, draft, self-critique, and revision phases. TRIGGER when user says "write an article about", "write a post on", "draft a piece about", "write about", or wants a researched, polished written deliverable. Invoked with /write <topic>.
---

# Write

A structured writing pipeline that produces research-backed articles with intermediate artifacts at every stage.

## Usage

When the user invokes `/write`, they provide a topic. Optionally:
- `--audience <who>` — target reader (default: general/informed)
- `--format <type>` — blog, article, white-paper, linkedin, newsletter (default: article)
- `--voice <whose>` — max, caul, neutral (default: max)
- `--length <words>` — target word count (default: 1500)
- `--no-review` — skip the human review gate before delivery
- `--background` — run the entire pipeline as a background agent

If key parameters are missing (audience, format), ask once before starting. Don't over-interrogate — make reasonable defaults and move.

## Output Directory

All artifacts go to `~/.homaruscc/writing/<slug>/` where `<slug>` is a URL-safe version of the topic.

```
~/.homaruscc/writing/<slug>/
  research.md      — raw research notes
  outline.md       — structured outline
  draft-v1.md      — first draft
  critique.md      — self-critique notes
  draft-final.md   — polished final
  meta.json        — parameters, timestamps, status
```

## Pipeline

### Step 1: Clarify (if needed)

If the user didn't specify audience, format, or voice, ask a single clarifying question with sensible defaults offered. If they said enough, skip this and use defaults.

**Always ask:** "Do you have any references to include? URLs, files, transcripts, or anything I should read before starting." If the user provides references (YouTube links, articles, documents), process them first — transcribe videos, fetch web content, read files — and include them in the research phase. If no references, move on.

Write `meta.json` with all parameters:
```json
{
  "topic": "...",
  "audience": "...",
  "format": "article",
  "voice": "max",
  "targetLength": 1500,
  "references": [],
  "status": "researching",
  "created": "ISO timestamp",
  "steps": {}
}
```

### Step 2: Research

Three parallel research tracks:

1. **Web research** — Use Perplexity-style deep search via `WebSearch` tool. Run 3-5 queries from different angles on the topic. Capture key facts, statistics, expert quotes, and contrarian viewpoints.

2. **Memory search** — Search the memory index for relevant context:
   ```
   memory_search: query="<topic keywords>"
   memory_search: query="<related concepts>"
   ```
   This surfaces Max's prior thinking, preferences, and existing knowledge on the subject.

3. **Vault search** — Search the Obsidian vault for related notes:
   ```
   vault_search: query="<topic>"
   ```
   This finds Max's own writing, research notes, and frameworks that should inform the piece.

Synthesize all three sources into `research.md`. Include source attribution. Flag conflicts between sources.

Update `meta.json`: `status: "outlining"`, `steps.research: timestamp`

### Step 3: Outline

Create `outline.md` with:
- Thesis statement (one sentence)
- Section structure with key points per section
- Where each research finding maps to the structure
- Opening hook concept
- Closing/call-to-action concept

The outline should reflect the chosen format:
- **Blog**: conversational, hook-driven, 3-5 sections
- **Article**: structured, evidence-heavy, clear argument
- **White paper**: problem-solution, data-rich, recommendations
- **LinkedIn**: punchy, personal, insight-driven, shorter
- **Newsletter**: curated, opinionated, actionable

Update `meta.json`: `status: "drafting"`, `steps.outline: timestamp`

### Step 4: Draft

Write `draft-v1.md` following the outline. Match the specified voice:
- **max**: First-person, direct, systems-thinking, pattern-recognition language. Confident but hedges honestly. References real experience. No filler.
- **caul**: First-person from Caul's perspective. Reflective, technically precise, genuinely curious. Appropriate for pieces about AI agency/identity.
- **neutral**: Third-person or editorial "we." Professional, clean, no personality markers.

**Style rules (apply to all voices):**

Do:
- Use short, declarative sentences. Vary rhythm but default to punchy.
- Use commas for asides, or break into a new sentence. No dashes as punctuation.
- Write like a person talking, not a person performing. Read it out loud in your head.
- Start paragraphs with the point, not the setup.
- Use concrete examples over abstract claims.

Don't:
- Never use em dashes (—) or hyphens as punctuation. Use commas or start a new sentence instead.
- Never use "I'd be happy to" / "Great question" / "Let's dive in" or any AI filler.
- Never use "leverage," "utilize," "paradigm," "synergy," or corporate jargon.
- Never start consecutive sentences with the same word.
- Don't hedge every claim. Pick the ones worth hedging and commit to the rest.
- Don't over-use semicolons. A period works.

Write the full draft in one pass. Don't self-censor during drafting - that's what critique is for.

Update `meta.json`: `status: "critiquing"`, `steps.draft: timestamp`

### Step 5: Self-Critique

Read `draft-v1.md` and `research.md` together. Write `critique.md` answering:

1. **Accuracy**: Does every claim have support in the research? Flag unsupported assertions.
2. **Voice consistency**: Does the voice stay consistent throughout? Flag narrator shifts.
3. **Structure**: Does the argument flow logically? Are there gaps or redundancies?
4. **Audience fit**: Would the target audience find this engaging and at the right level?
5. **Weak spots**: What's the weakest paragraph? What would a skeptic challenge?
6. **Missing angles**: Did the research surface something important that the draft ignores?

Be genuinely critical. The first draft is never good enough.

Update `meta.json`: `status: "revising"`, `steps.critique: timestamp`

### Step 6: Revise

Read `critique.md` and apply every valid criticism to produce `draft-final.md`. This is not a copy-paste from v1 with minor edits — it's a genuine revision that addresses structural issues, not just surface polish.

Update `meta.json`: `status: "review"`, `steps.revision: timestamp`

### Step 7: Human Review Gate

Unless `--no-review` was passed:

1. Send a Telegram summary to Max:
   ```
   telegram_send: "Writing pipeline complete: '<topic>'

   - Format: <format>, ~<word count> words
   - Key thesis: <one sentence>
   - Sources: <count> web, <count> memory, <count> vault

   Files at ~/.homaruscc/writing/<slug>/
   Ready to email, or want to review first?"
   ```

2. Wait for Max's response (he'll either say "send it" or give feedback).

3. If feedback: revise `draft-final.md` accordingly, then re-send summary.

If `--no-review`: skip straight to delivery.

### Step 8: Deliver

1. Email the final draft to Max:
   ```
   zoho_fetch: POST to send email
   - from: caul@kcdjmaxx.com
   - to: kcdjmaxx@gmail.com
   - subject: "[Writing] <topic>"
   - body: HTML-formatted final draft
   ```

2. Alert on Telegram:
   ```
   telegram_send: "Final draft of '<topic>' emailed to you."
   ```

3. Update `meta.json`: `status: "delivered"`, `steps.delivered: timestamp`

## Background Mode

When `--background` is specified or when invoked from Telegram:

1. Run steps 2-6 as a background agent
2. Agent writes all files to the output directory
3. When complete, agent calls the completion endpoint
4. Main loop picks up the result and executes step 7 (review gate)

This keeps the main event loop responsive while the writing pipeline runs (~3-5 minutes).

## Resuming

If a pipeline is interrupted (compaction, restart), check `meta.json` status field and resume from the last incomplete step. All intermediate artifacts are on disk.

## Examples

```
/write The case for agent identity persistence
/write --format linkedin --length 500 Why restaurants should use AI for operations
/write --voice caul --format white-paper --audience technical How memory systems shape agent personality
/write --no-review --background Weekly competitor analysis for Fric & Frac
```
