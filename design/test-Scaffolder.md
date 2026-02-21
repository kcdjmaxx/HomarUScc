# Test Design: Scaffolder
**Source:** crc-Scaffolder.md

## Test: creates directory structure
**Purpose:** Verify all required directories are created
**Input:** Minimal answers object with defaults
**Expected:** `~/.homaruscc/`, `identity/`, `journal/`, `memory/`, `transcripts/` all exist
**Refs:** crc-Scaffolder.md

## Test: writes config with telegram enabled
**Purpose:** Verify config.json includes telegram section when selected
**Input:** answers with channels = ["telegram", "dashboard"], telegramToken = "test-token"
**Expected:** config.json contains `channels.telegram` with `token: "${TELEGRAM_BOT_TOKEN}"` and `dashboard.enabled: true`
**Refs:** crc-Scaffolder.md

## Test: writes config without telegram
**Purpose:** Verify config.json omits telegram when not selected
**Input:** answers with channels = ["dashboard"]
**Expected:** config.json has no `channels.telegram` key, `dashboard.enabled: true`
**Refs:** crc-Scaffolder.md

## Test: writes env file with telegram token
**Purpose:** Verify .env contains the collected token
**Input:** answers with telegramToken = "123:ABC"
**Expected:** .env contains `TELEGRAM_BOT_TOKEN=123:ABC`
**Refs:** crc-Scaffolder.md

## Test: writes env file without telegram token
**Purpose:** Verify .env is written with placeholder when no telegram
**Input:** answers with no telegramToken
**Expected:** .env exists, does not contain TELEGRAM_BOT_TOKEN line
**Refs:** crc-Scaffolder.md

## Test: copies template identity files
**Purpose:** Verify all 5 identity files are created from templates
**Input:** answers with identityPath = "template", agentName = "Caul", userName = "Max"
**Expected:** soul.md, user.md, state.md, preferences.md, disagreements.md exist in identity/; user.md contains "Max"; soul.md is template content
**Refs:** crc-Scaffolder.md

## Test: writes alignment generator soul.md
**Purpose:** Verify user-pasted soul content is written
**Input:** answers with identityPath = "alignment-generator", soulContent = "# Custom Soul\n..."
**Expected:** soul.md contains the pasted content; other identity files are template defaults
**Refs:** crc-Scaffolder.md

## Test: interpolates agent name into soul.md template
**Purpose:** Verify agent name replaces placeholder in template
**Input:** answers with identityPath = "template", agentName = "Ember"
**Expected:** soul.md first line references "Ember" (not generic placeholder)
**Refs:** crc-Scaffolder.md

## Test: skipped agent name uses generic template
**Purpose:** Verify null agentName leaves template as-is
**Input:** answers with agentName = null
**Expected:** soul.md contains generic template text without specific name
**Refs:** crc-Scaffolder.md
