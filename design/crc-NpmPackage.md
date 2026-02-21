# NpmPackage
**Requirements:** R163, R177, R178

## Knows
- binEntry: `{ "homaruscc": "dist/cli.js" }`
- filesArray: `["dist/", "bin/", "identity.example/", "config.example.json", ".env.example", "README.md", "LICENSE"]`
- npmignorePatterns: patterns to exclude from npm tarball

## Does
- (This is a configuration-only card -- no runtime behavior)
- Describes the required package.json changes and .npmignore contents

## Notes
- package.json `bin` field: `{ "homaruscc": "dist/cli.js" }`
- package.json `files` field: already mostly correct, add `dist/cli.js` (covered by `dist/`)
- `.npmignore` excludes: `src/`, `specs/`, `design/`, `docs/`, `dashboard/`, `*.test.ts`, `tsconfig.json`, `.env`, `node_modules/`, `.claude/`, `dreams/`, `refs/`
- `dist/cli.js` must have `#!/usr/bin/env node` shebang (TypeScript adds this via banner or source shebang)

## Collaborators
- None (configuration artifact)

## Sequences
- None
