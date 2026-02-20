# Test Design: Config
**Source:** crc-Config.md

## Test: env var substitution
**Purpose:** ${VAR} patterns resolve to environment variables
**Input:** Config with `{"token": "${MY_TOKEN}"}`, env MY_TOKEN=abc123
**Expected:** Loaded config has token: "abc123"
**Refs:** crc-Config.md

## Test: nested env var substitution
**Purpose:** Env vars resolve in nested objects and arrays
**Input:** Config with nested `{"channels": {"tg": {"token": "${TG_TOKEN}"}}}`
**Expected:** Deep value resolved correctly
**Refs:** crc-Config.md

## Test: default config when file missing
**Purpose:** Missing config file returns defaults without error
**Input:** Non-existent config path
**Expected:** Returns DEFAULT_CONFIG, logs info
**Refs:** crc-Config.md

## Test: safe change detection
**Purpose:** Changes to safe keys don't require restart
**Input:** Change memory.search.vectorWeight from 0.7 to 0.8
**Expected:** isSafeChange returns true
**Refs:** crc-Config.md

## Test: unsafe change detection
**Purpose:** Changes to non-safe keys flag restart needed
**Input:** Change channels.telegram.token
**Expected:** isSafeChange returns false
**Refs:** crc-Config.md
