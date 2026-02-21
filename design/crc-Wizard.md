# Wizard
**Requirements:** R167, R168, R169, R170, R171, R179, R180, R181, R183

## Knows
- answers: collected user responses (agentName, channels, identityPath, userName, userContext, telegramToken)
- steps: ordered list of wizard steps

## Does
- run(): execute all wizard steps in sequence, then delegate to Scaffolder
- promptAgentName(): ask for agent name, allow skip (returns null)
- promptChannels(): ask which channels to enable, return set of channel names
- promptIdentity(): offer Alignment Generator vs template; if AG, open browser and wait for paste; return chosen path + content
- promptUserContext(): ask for user name and freeform context
- promptTokens(channels): collect tokens for enabled channels (TELEGRAM_BOT_TOKEN)
- openBrowser(url): open URL in default browser via child_process (macOS: `open`, Linux: `xdg-open`)
- printSummary(files): print created files and next steps

## Collaborators
- Scaffolder: receives collected answers and writes files
- ClaudeCodeRegistrar: offered after scaffolding to register MCP server
- readline (Node.js built-in): used for interactive prompts

## Sequences
- seq-first-run.md
