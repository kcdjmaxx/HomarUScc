# Sequence: First Run (On Birth Wizard)

**Requirements:** R164, R166, R167, R168, R169, R170, R171, R172, R173, R174, R175, R176, R181, R183

## Trigger
User runs `npx homaruscc` with no existing `~/.homaruscc/config.json`.

## Participants
- Cli
- Wizard
- Scaffolder
- ClaudeCodeRegistrar

## Flow

```
Cli                    Wizard                 Scaffolder             ClaudeCodeRegistrar
 |                      |                      |                      |
 |--resolveConfigPath-->|                      |                      |
 |  (not found)         |                      |                      |
 |                      |                      |                      |
 |--import + run()----->|                      |                      |
 |                      |                      |                      |
 |                      |--promptAgentName()   |                      |
 |                      |  "What should your   |                      |
 |                      |   agent be called?"  |                      |
 |                      |  => agentName|null   |                      |
 |                      |                      |                      |
 |                      |--promptChannels()    |                      |
 |                      |  [x] Dashboard       |                      |
 |                      |  [ ] Telegram        |                      |
 |                      |  => Set<channel>     |                      |
 |                      |                      |                      |
 |                      |--promptIdentity()    |                      |
 |                      |  1) Alignment Gen    |                      |
 |                      |  2) Template         |                      |
 |                      |                      |                      |
 |                      |  [if AG chosen]      |                      |
 |                      |  openBrowser(url)    |                      |
 |                      |  "Paste output:"     |                      |
 |                      |  => soulContent      |                      |
 |                      |                      |                      |
 |                      |--promptUserContext() |                      |
 |                      |  "Your name?"        |                      |
 |                      |  "Agent should know?"|                      |
 |                      |  => {name, context}  |                      |
 |                      |                      |                      |
 |                      |--promptTokens()      |                      |
 |                      |  [if telegram]       |                      |
 |                      |  "Bot token?"        |                      |
 |                      |  => telegramToken    |                      |
 |                      |                      |                      |
 |                      |--scaffold(answers)-->|                      |
 |                      |                      |--createDirectories() |
 |                      |                      |  ~/.homaruscc/       |
 |                      |                      |  identity/           |
 |                      |                      |  journal/            |
 |                      |                      |  memory/             |
 |                      |                      |  transcripts/        |
 |                      |                      |                      |
 |                      |                      |--writeConfig()       |
 |                      |                      |  config.json         |
 |                      |                      |                      |
 |                      |                      |--writeEnv()          |
 |                      |                      |  .env                |
 |                      |                      |                      |
 |                      |                      |--writeIdentityFiles()|
 |                      |                      |  soul.md, user.md,   |
 |                      |                      |  state.md,           |
 |                      |                      |  preferences.md,     |
 |                      |                      |  disagreements.md    |
 |                      |                      |                      |
 |                      |<--createdFiles()-----|                      |
 |                      |                      |                      |
 |                      |--promptRegister()--->|---------------------->|
 |                      |                      |                      |--detectSettingsFile()
 |                      |                      |                      |  ~/.claude.json or
 |                      |                      |                      |  ~/.claude/settings.json
 |                      |                      |                      |
 |                      |                      |                      |  [if found + user says yes]
 |                      |                      |                      |--register()
 |                      |                      |                      |  add mcpServers entry
 |                      |                      |                      |
 |                      |--printSummary()      |                      |
 |                      |  "Created files..."  |                      |
 |                      |  "Next: run again"   |                      |
 |                      |                      |                      |
 |<--return-------------|                      |                      |
 |                      |                      |                      |
```
