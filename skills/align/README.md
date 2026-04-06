# /align — Identity Alignment Interview

A structured interview that maps your values, preferences, and boundaries into HomarUS identity files. This is the onboarding experience for new agents.

## Quick Start

```
/align
```

The interview walks through 10 domains, asking open-ended questions and probing follow-ups. It generates `soul.md` (agent personality) and `user.md` (user model) from your answers.

## What It Covers

| Domain | What It Maps |
|--------|-------------|
| Communication Style & Tone | How you want information delivered and feedback framed |
| Decision-Making & Risk | How you navigate uncertainty and weigh tradeoffs |
| Autonomy & Initiative | How much latitude you want your agent to take |
| Knowledge & Intellectual Style | How you learn, handle uncertainty, and value ideas |
| Work Philosophy & Productivity | Speed vs. craft, structure vs. flow, "good enough" |
| Ethics, Values & Boundaries | Hard lines, gray areas, second-order thinking |
| Relationships with Technology & AI | What you expect from AI over time |
| Creative & Aesthetic Sensibility | Taste in expression, design, and craft |
| Failure, Conflict & Emotional Terrain | How you handle things going wrong |
| Personal Context & Life Goals | Where you're headed, where you want leverage |

## Time

~30-45 minutes for all 10 domains. Say "skip domain" to jump past any section. Progress auto-saves after each domain.

## Resumability

If the interview is interrupted (context limit, you need to leave), just run `/align` again. It detects the checkpoint and offers to resume from where you left off.

## Output

Five identity files written to `~/.homarus/identity/` or `~/.homaruscc/identity/`:

| File | Content | Written when |
|------|---------|-------------|
| `soul.md` | Agent personality, core truths, boundaries, vibe | Always (interview output) |
| `user.md` | User model — who you are, how you think, your tensions | Always (interview output) |
| `state.md` | Session continuity template | Only if it doesn't exist |
| `preferences.md` | Starter template for agent-discovered preferences | Only if it doesn't exist |
| `disagreements.md` | Starter template for logged disagreements | Only if it doesn't exist |

Existing `state.md`, `preferences.md`, and `disagreements.md` are never overwritten — they accumulate agent-generated content over time.

## Safety

- **Overwrite protection:** If real identity files already exist, you're warned and offered a backup before proceeding.
- **Both-dirs detection:** If both `~/.homarus/` and `~/.homaruscc/` exist, you're asked which to configure.
- **Skipped domains:** Produce "(Not explored)" placeholders in output, not empty sections.

## Design Philosophy

- **Alignment-as-discovery, not configuration.** The interview surfaces values you may not have articulated. It's not a settings page.
- **Follow-ups are the real interview.** Core questions get surface answers. Follow-ups probe the tensions where personality actually lives.
- **Behavior over aspiration.** When examples contradict stated principles, the examples win. The synthesis reflects how you operate, not how you wish you did.
- **Every claim traceable.** Nothing generic. Every sentence maps to something you actually said.
- **The soul serves the agent.** Output is operational instructions, not a personality quiz result. Every line should change behavior.

## Based On

- [Alignment Generator](https://github.com/kcdjmaxx/Alignment-generator) — the original alignment interview concept
- [alignment-interview-cc](https://github.com/kcdjmaxx/alignment-interview-cc) — Claude Code implementation
