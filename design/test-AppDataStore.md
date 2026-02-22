# Test Design: AppDataStore
**Source:** crc-AppDataStore.md

## Test: read returns data.json contents
**Purpose:** Verify read hook reads and parses the data file
**Input:** Create app dir with data.json containing `{"items": [1,2,3]}`
**Expected:** read("test-app") returns `{items: [1,2,3]}`
**Refs:** crc-AppDataStore.md, seq-apps-invoke.md

## Test: read returns empty object when no data.json
**Purpose:** Verify graceful handling of missing data file
**Input:** App directory exists but has no data.json
**Expected:** read("test-app") returns `{}`
**Refs:** crc-AppDataStore.md

## Test: write creates data.json
**Purpose:** Verify write hook persists data
**Input:** Call write("test-app", {count: 42}) on an app with no existing data.json
**Expected:** data.json exists with `{count: 42}`; subsequent read returns same
**Refs:** crc-AppDataStore.md, seq-apps-invoke.md

## Test: write overwrites existing data
**Purpose:** Verify write replaces entire data file
**Input:** Existing data.json with `{a: 1}`, call write with `{b: 2}`
**Expected:** data.json contains only `{b: 2}`
**Refs:** crc-AppDataStore.md

## Test: describe generates summary from data
**Purpose:** Verify describe produces readable text
**Input:** Manifest with description "Budget tracker", data with `{entries: [{amount:50}], total: 50}`
**Expected:** Returned text includes app description and data summary (key names and counts)
**Refs:** crc-AppDataStore.md

## Test: invoke returns error for unknown app
**Purpose:** Verify error handling on invalid slug
**Input:** invoke("nonexistent", "read", {})
**Expected:** Returns error result with message indicating app not found
**Refs:** crc-AppDataStore.md

## Test: invoke returns error for undeclared hook
**Purpose:** Verify error when app exists but hook not declared in manifest
**Input:** App manifest with only "read" hook; invoke("app", "write", {})
**Expected:** Returns error result indicating hook not available
**Refs:** crc-AppDataStore.md
