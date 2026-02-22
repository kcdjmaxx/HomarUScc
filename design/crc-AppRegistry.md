# AppRegistry
**Requirements:** R186, R187, R197, R198, R201, R204, R205, R206, R207, R202, R208

## Knows
- apps: Map<string, AppManifest> — slug to parsed manifest
- appsDir: string — root directory for apps (default ~/.homaruscc/apps/)
- watcher: FSWatcher | null — chokidar watcher on apps directory
- logger: Logger

## Does
- constructor(appsDir, logger): store config, ensure appsDir exists (R205)
- scan(): read all `*/manifest.json` under appsDir, parse and validate each, populate apps map; log and skip invalid manifests (R197, R206)
- get(slug): return manifest for a given slug or undefined
- getAll(): return array of all registered AppManifest objects (R198, R207)
- startWatching(): start chokidar watcher on appsDir for manifest.json add/change/unlink events; re-scan affected app on change (R201)
- stopWatching(): close the file watcher
- validateManifest(raw): check required fields (name, slug, version), return parsed AppManifest or null

## Collaborators
- DashboardServer: provides REST endpoints that delegate to AppRegistry
- AppDataStore: resolves data paths based on app directory structure

## Sequences
- seq-apps-startup.md
- seq-apps-invoke.md
