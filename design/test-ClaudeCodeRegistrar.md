# Test Design: ClaudeCodeRegistrar
**Source:** crc-ClaudeCodeRegistrar.md

## Test: detects ~/.claude.json
**Purpose:** Verify detection of claude.json settings file
**Input:** File exists at `~/.claude.json`
**Expected:** detectSettingsFile() returns that path
**Refs:** crc-ClaudeCodeRegistrar.md

## Test: detects ~/.claude/settings.json
**Purpose:** Verify fallback to settings.json
**Input:** No `~/.claude.json`, but `~/.claude/settings.json` exists
**Expected:** detectSettingsFile() returns the settings.json path
**Refs:** crc-ClaudeCodeRegistrar.md

## Test: no settings file found
**Purpose:** Verify graceful handling when no Claude Code settings exist
**Input:** Neither settings file exists
**Expected:** detectSettingsFile() returns null; register is not attempted
**Refs:** crc-ClaudeCodeRegistrar.md

## Test: registers MCP server entry
**Purpose:** Verify correct JSON structure is written
**Input:** Existing settings.json with `mcpServers: {}`
**Expected:** After register(), file contains `mcpServers.homaruscc` with `command: "npx"` and `args: ["homaruscc"]`
**Refs:** crc-ClaudeCodeRegistrar.md

## Test: preserves existing settings
**Purpose:** Verify other settings are not clobbered
**Input:** Existing settings.json with other mcpServers entries and other top-level keys
**Expected:** After register(), all pre-existing entries and keys remain intact
**Refs:** crc-ClaudeCodeRegistrar.md
