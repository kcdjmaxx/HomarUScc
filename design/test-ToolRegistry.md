# Test Design: ToolRegistry
**Source:** crc-ToolRegistry.md

## Test: register and execute tool
**Purpose:** Registered tool can be looked up and executed
**Input:** Register tool "echo", execute with {text: "hello"}
**Expected:** Returns {output: "hello"}
**Refs:** crc-ToolRegistry.md

## Test: deny policy blocks execution
**Purpose:** Tool blocked by deny policy throws error
**Input:** Register tool "bash", add deny policy for "bash", execute
**Expected:** Execution rejected with policy error
**Refs:** crc-ToolRegistry.md

## Test: group resolution
**Purpose:** Group names expand to individual tool names
**Input:** Register group "group:fs" with ["read", "write"], resolve
**Expected:** resolveGroup returns ["read", "write"]
**Refs:** crc-ToolRegistry.md

## Test: bash dangerous pattern blocking
**Purpose:** Bash tool rejects dangerous commands
**Input:** Execute bash tool with "rm -rf /"
**Expected:** Returns error, command not executed
**Refs:** crc-ToolRegistry.md
