# On Birth: First-Run Wizard

**Language:** TypeScript
**Environment:** Node.js >= 22, compiled to dist/

## Overview

"On Birth" is a first-run setup wizard for HomarUScc. The metaphor: a caul is the membrane covering a newborn -- "removing the caul" is the agent's first breath. When a user installs HomarUScc via npm and runs `npx homaruscc` for the first time with no existing config, the wizard guides them through initial setup.

## CLI Entry Point

The package needs a `bin` entry in package.json so `npx homaruscc` works. The binary detects whether `~/.homaruscc/config.json` exists:

- If config exists: start normally (spawn the MCP proxy/server)
- If no config: run the "On Birth" wizard

## Wizard Steps

The wizard walks the user through these steps interactively:

### 1. Agent Name
Prompt: "What should your agent be called?"
- User can type a name
- User can skip (agent picks its own name on first run)

### 2. Channels
Which channels to enable:
- **Telegram** -- needs bot token from @BotFather
- **Dashboard** -- always enabled, localhost:3120

### 3. Identity
Two paths:
- **Alignment Generator** -- opens https://kcdjmaxx.github.io/Alignment-generator/ in browser, tells user to paste output into soul.md
- **Template** -- copies identity.example/*.md files as-is

### 4. User Context
Basic user.md questions:
- "What's your name?"
- "What should the agent know about you?"

### 5. Env Tokens
Collect `TELEGRAM_BOT_TOKEN` if Telegram was selected in step 2.

## File Scaffolding

After wizard completion, create:
- `~/.homaruscc/` directory
- `~/.homaruscc/config.json` from collected answers
- `~/.homaruscc/.env` with tokens
- `~/.homaruscc/identity/` with identity files (soul.md, user.md, state.md, preferences.md, disagreements.md)
- `~/.homaruscc/journal/` directory
- `~/.homaruscc/memory/` directory
- `~/.homaruscc/transcripts/` directory

## Claude Code Integration

After scaffolding:
- Auto-detect Claude Code settings file location (`~/.claude.json` or `~/.claude/settings.json`)
- Offer to register HomarUScc as an MCP server in the settings

## npm Publish Readiness

Ensure package.json has correct:
- `bin` field pointing to the CLI entry point
- `files` array includes `dist/`, `bin/`, `identity.example/`, templates
- `main` and `types` fields
- `.npmignore` excludes dev files, specs, design, tests, dashboard source, etc.
- `npm pack` produces a clean tarball
