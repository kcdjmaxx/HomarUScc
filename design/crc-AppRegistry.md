# AppRegistry
**Requirements:** R186, R187, R197, R198, R201, R204, R205, R206, R207, R202, R208, R416, R422

## Knows
- apps: Map<string, AppManifest> -- slug to parsed manifest
- appsDir: string -- root directory for apps (default ~/.homaruscc/apps/)
- logger: Logger

## Does
- constructor(appsDir, logger): store config, ensure appsDir exists (R205)
- scan(): read all `*/manifest.json` under appsDir, parse and validate each, populate apps map; log and skip invalid manifests (R197, R206)
- get(slug): return manifest for a given slug or undefined
- getAll(): return array of all registered AppManifest objects (R198, R207)
- validateManifest(raw): check required fields (name, slug, version), return parsed AppManifest or null
- registerWithSkillsRegistry(): register each discovered app as a `surface: "apps"` skill in the frontend SkillsRegistry via /api/apps (R416, R422). Note: backend provides manifest data via REST; frontend AppsView calls getAppsSkills() to merge.

## Collaborators
- DashboardServer: provides REST endpoints that delegate to AppRegistry for manifest scanning and data access
- AppDataStore: resolves data paths based on app directory structure
- SkillsRegistry (frontend): AppsView fetches /api/apps and renders apps; external apps are surfaced via getAppsSkills() if registered

## Sequences
- seq-apps-startup.md
- seq-apps-invoke.md

## Notes
- File watching (R201) is deferred -- MVP uses scan-on-startup only. The existing inline /api/apps route in DashboardServer already re-reads manifests per request, providing eventual consistency without a watcher.
- The SkillsRegistry lives in the frontend. Backend AppRegistry provides data via REST. Frontend AppsView bridges between /api/apps responses and the registry.
