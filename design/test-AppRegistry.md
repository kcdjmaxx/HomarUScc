# Test Design: AppRegistry
**Source:** crc-AppRegistry.md

## Test: scan discovers valid manifests
**Purpose:** Verify that scan reads all manifest.json files and populates the registry
**Input:** Create temp dir with two subdirectories, each containing a valid manifest.json
**Expected:** getAll() returns 2 entries with correct names, slugs, and hook declarations
**Refs:** crc-AppRegistry.md, seq-apps-startup.md

## Test: scan skips invalid manifests
**Purpose:** Verify that malformed or incomplete manifests do not crash the scan
**Input:** Create temp dir with one valid manifest and one missing required fields (no slug)
**Expected:** getAll() returns 1 entry; logger.warn called for the invalid one
**Refs:** crc-AppRegistry.md

## Test: get returns manifest by slug
**Purpose:** Verify lookup by slug
**Input:** Scan a dir with one app (slug: "budget")
**Expected:** get("budget") returns the manifest; get("nonexistent") returns undefined
**Refs:** crc-AppRegistry.md

## Test: directory created if missing
**Purpose:** Verify appsDir is created on construction
**Input:** Pass a non-existent directory path to constructor
**Expected:** Directory exists after construction
**Refs:** crc-AppRegistry.md

## Test: validateManifest rejects missing fields
**Purpose:** Verify schema validation
**Input:** Objects missing name, slug, or version
**Expected:** Returns null for each
**Refs:** crc-AppRegistry.md
