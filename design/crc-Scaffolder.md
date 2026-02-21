# Scaffolder
**Requirements:** R172, R173, R174, R175, R182, R184

## Knows
- baseDir: `~/.homaruscc/`
- templateDir: resolved path to `identity.example/` within the package

## Does
- scaffold(answers): orchestrate all file creation from wizard answers
- createDirectories(): create baseDir, identity/, journal/, memory/, transcripts/
- writeConfig(answers): derive config.json from config.example.json, enable/disable channels per answers
- writeEnv(answers): write .env file with collected tokens
- writeIdentityFiles(answers): copy template files or write Alignment Generator output; interpolate agent name and user name
- createdFiles(): return list of files created for summary display

## Collaborators
- fs (Node.js built-in): file system operations
- Config template: reads config.example.json from package directory

## Sequences
- seq-first-run.md
