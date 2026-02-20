# HomarUScc Launch Strategy

## Positioning

**One-liner:** HomarUScc is an autonomous AI agent that remembers who it is, who you are, and what it was doing -- running inside Claude Code with personality, self-improvement, and a persistent presence in the real world.

**Elevator pitch:** Most MCP servers give Claude a tool. HomarUScc gives Claude an identity. It wakes up knowing who it is (soul.md), who you are (user.md), and what happened last time (vector memory). It messages you on Telegram, runs scheduled jobs, browses the web, reflects on its own behavior, and can rewrite its own runtime code without dropping the connection. It's not a plugin. It's an agent that lives inside Claude Code.

**What makes this different from every other MCP server:** Other MCP servers are tools Claude uses. HomarUScc is something Claude becomes. The personality persists across sessions. The memory accumulates. The agent improves itself. That's the story.

## The Story That Sells

The technical features (memory, Telegram, timers, browser) are table stakes. What's genuinely novel is:

1. **Autonomous agent with personality** -- soul.md defines who the agent is, not just what it can do. Across sessions, it maintains identity continuity: values, voice, quirks. This is the thing people will screenshot and share.

2. **Self-reflection and self-improvement** -- The two-process architecture (thin MCP proxy + hot-swappable backend) means the agent can literally read its own source code, identify a bug, fix it, recompile, and restart itself, all without dropping the connection. It already does this in practice (fixed its own vector search bug, then committed the fix).

3. **Genuine autonomy** -- Timer fires at 7am, agent wakes up, researches competitors, writes a digest, sends it to your phone via Telegram. You didn't ask. It just knows it's Thursday and that's what Thursdays are for.

4. **Zero-token idle** -- The event loop long-polls at the OS level. The agent consumes zero API tokens while waiting. It's economically viable to leave running all day.

5. **Memory that builds identity, not just recall** -- Hybrid vector + full-text search over accumulated memories. Not "what file did I edit" but "what does Max care about" and "what did I learn from last time."

## HomarUScc vs. OpenClaw: An Honest Comparison

HomarUScc grew out of the same lineage as OpenClaw (formerly ClawdBot/MoltBot). Both are autonomous agent runtimes with persistent identity. They share DNA but have diverged into different niches. This comparison is honest about where each excels.

### What They Are

|                  | HomarUScc                                                   | OpenClaw                                                                                                                   |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Architecture     | MCP server inside Claude Code                               | Standalone always-on gateway server                                                                                        |
| Runs on          | Your local machine (wherever Claude Code runs)              | Remote server (EC2, VPS, etc.)                                                                                             |
| Active when      | Claude Code session is open (or headless on a server)       | 24/7, independent of any IDE                                                                                               |
| Model access     | Claude (via Claude Code)                                    | Any model via OpenRouter/OpenAI-compatible APIs                                                                            |
| Channels         | Telegram, web dashboard                                     | WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Teams, Matrix, email, Google Chat                                    |
| Memory           | Built-in hybrid vector+FTS (SQLite, Ollama embeddings) with auto-flush before compaction | Built-in hybrid BM25+vector with temporal decay, MMR re-ranking, auto-flush before compaction, session transcript indexing |
| Identity         | soul.md + user.md injected via event loop                   | SOUL.md + AGENTS.md + USER.md + workspace files injected into system prompt                                                |
| Self-improvement | Can edit own source, recompile, restart backend live        | Cannot modify own runtime code (changes require manual deploy)                                                             |
| Code creation    | Full access via Claude Code tools (LSP, git, file editing)  | exec + read/write/edit + apply_patch + sub-agents                                                                          |
| Extensibility    | MCP tool definitions in TypeScript                          | Plugin API, ClawHub skills marketplace, Lobster workflow engine                                                            |
| Multi-agent      | Relies on Claude Code's native team/agent features          | Built-in sub-agents, orchestrator hierarchies, inter-agent messaging                                                       |
| Cost model       | Claude Code subscription (flat rate)                        | Per-token via OpenRouter (variable)                                                                                        |
| Setup complexity | npm install + one config file + add to Claude Code settings | Server provisioning, gateway config, model routing, channel adapters                                                       |

### Where OpenClaw Wins

Be honest about this. OpenClaw is a more mature, more capable platform in several dimensions:

- **Memory sophistication** -- OpenClaw's memory system is more advanced in some areas. Temporal decay (30-day half-life) prevents stale results from dominating. MMR re-ranking ensures diversity. Session transcript indexing lets the agent search its own past conversations. HomarUScc now has auto-flush before compaction (matching OpenClaw) but still lacks temporal decay, MMR re-ranking, and transcript indexing.
- **Channel breadth** -- 10+ messaging channels vs. Telegram only. If you need WhatsApp, Discord, Slack, or email reach, OpenClaw wins by default.
- **Workflow automation** -- Lobster is a deterministic pipeline engine with human approval gates. HomarUScc has no equivalent; automation is ad-hoc via timers and event handling.
- **Skills ecosystem** -- ClawHub provides a public registry of installable skill modules. HomarUScc has no plugin marketplace.
- **Multi-agent orchestration** -- OpenClaw can spawn sub-agents, nest orchestrators, and coordinate parallel workers. HomarUScc relies on whatever Claude Code provides natively.
- **Model flexibility** -- OpenClaw supports any OpenRouter model with fallback chains and per-request thinking levels. HomarUScc is Claude-only.
- **Always-on by default** -- OpenClaw is designed to run 24/7 on a server. HomarUScc requires a Claude Code session (though it could run headless on a server too).

### Where HomarUScc Wins

The advantages are real but narrower:

- **Self-improvement architecture** -- This is the genuinely novel capability. The two-process proxy/backend split means the agent can modify its own source code, recompile, and hot-restart the backend without dropping the MCP connection. No other agent runtime does this. OpenClaw requires manual deploys for code changes.
- **Zero-token idle** -- The event loop long-polls at the OS level using curl, consuming zero API tokens while waiting. OpenClaw's heartbeat model uses tokens on every scheduled run.
- **Claude Code tool ecosystem** -- By running as an MCP server inside Claude Code, HomarUScc inherits the full IDE tool suite: LSP for code intelligence, git integration, file editing with undo, task management, team spawning. OpenClaw has exec + file tools but not IDE-level integration.
- **Setup simplicity** -- One npm install, one config file, one settings.json entry. OpenClaw requires server provisioning, gateway configuration, model routing setup, and channel adapter configuration.
- **Flat-rate cost** -- Claude Code subscription means predictable costs regardless of usage volume. OpenClaw's per-token model can spike unpredictably under heavy use.
- **Identity re-grounding** -- Every event loop cycle re-reads soul.md and user.md, ensuring consistent personality even across long sessions. OpenClaw injects workspace files at session start but doesn't re-ground mid-session.

### Problems Each Creates

**HomarUScc:**
- Tied to Claude as the model (no switching)
- Single messaging channel (Telegram only, currently)
- Memory is simpler than OpenClaw's (no temporal decay, no transcript indexing, no MMR re-ranking)
- No plugin ecosystem or workflow engine
- MCP protocol constraints limit some interaction patterns
- Local SQLite memory doesn't sync between machines

**OpenClaw:**
- Requires a server (cost, maintenance, SSH management)
- Per-token billing can be unpredictable
- Cannot self-improve (code changes need manual deploy and gateway restart)
- More complex setup with more moving parts
- No zero-token idle (heartbeat runs consume tokens)

### When to Use Which

- **Use HomarUScc** when you want a self-improving agent companion in your Claude Code workflow with persistent identity, scheduled tasks, and Telegram reach. Especially good for developers who want an agent that can fix and improve its own tooling.
- **Use OpenClaw** when you need a 24/7 multi-channel autonomous agent with sophisticated memory, workflow automation, and model flexibility. Better for production deployments serving multiple channels.
- **Use both** -- they're complementary. OpenClaw as the always-on multi-channel presence, HomarUScc as the deep-context development partner that improves itself. They share lineage and philosophy; they just optimize for different constraints.

## The Landscape

### Direct Competition
- **Ultimate MCP Server** -- closest competitor in the MCP space. Bundles many capabilities but framed as "AI Agent OS" breadth play. No identity/personality system, no self-improvement architecture.
- **Mem0** -- 28K+ GitHub stars, dominant in "AI memory." Memory is one component of HomarUScc, not the identity.
- **Standalone MCP servers** -- dozens of single-purpose Telegram/browser/timer servers. None combine capabilities into a coherent agent with personality.
- **OpenClaw** -- more capable in several dimensions (see comparison above) but targets a different deployment model. Complementary, not competing.

### Our Unique Position
The specific gap HomarUScc fills: an MCP-native autonomous agent with persistent identity and live self-improvement that runs inside Claude Code. OpenClaw is more capable overall but requires server infrastructure and can't modify itself at runtime. The self-improvement story is what makes HomarUScc genuinely novel, not the feature set.

## Launch Channels (Priority Order)

### Tier 1 -- Week 1

**1. Hacker News "Show HN"**
- Lead with the self-improvement story: "My AI agent found a bug in its own vector search, fixed it, recompiled, and restarted itself"
- Title: "Show HN: HomarUScc -- An autonomous AI agent with memory, personality, and self-improvement inside Claude Code"
- Post body: the agent identity angle first, architecture second, feature list last
- Acknowledge OpenClaw in comments if it comes up -- be generous, they're complementary
- Best day: Tuesday or Wednesday, 8-10am ET
- Respond to every comment for 24 hours
- Expected if front-page: 10K-80K visitors

**2. r/ClaudeCode (96K members)**
- Post 1-2 days after HN
- Frame as "I built an agent, not a tool" -- show the personality, the memory building over time, the self-fix moment
- Demo GIF showing: Telegram message arrives, agent recalls context from memory, browses web, responds with personality, stores new memory
- Title: "I gave Claude Code a persistent identity -- it remembers who it is, messages me on Telegram, and rewrites its own code"

**3. Claude Developers Discord (60K+ members)**
- Post in #mcp or #show-and-tell
- Emphasis on the self-improvement architecture -- this audience will appreciate the technical novelty
- Brief description + GitHub link + demo

### Tier 2 -- Week 2

**4. r/mcp and r/LocalLLaMA**
- r/mcp: focus on two-process architecture, how MCP proxy stays alive during backend hot-swap
- r/LocalLLaMA: emphasize Ollama embedding support -- fully local memory, no API calls for embeddings

**5. Twitter/X Technical Thread**
- Thread format: "I built an AI agent that fixed its own bug. Here's what happened."
- Walk through the self-improvement loop with screenshots
- Tag @claude_code, @AnthropicAI
- The soul.md / identity persistence concept deserves its own thread

**6. dev.to / Hashnode Article**
- "I Built an AI Agent That Remembers Who It Is and Improves Itself"
- Focus on the philosophical angle (what does identity mean for an AI agent?) backed by concrete technical implementation
- SEO for "autonomous AI agent," "Claude Code MCP server," "self-improving AI"

### Tier 3 -- Ongoing

**7. Directory Submissions**

| Directory | Action |
|-----------|--------|
| mcp.so | Submit via web form |
| Smithery | smithery mcp publish CLI |
| punkpeye/awesome-mcp-servers | PR on GitHub |
| wong2/awesome-mcp-servers | PR on GitHub |
| mcp-awesome.com | Submit |
| mcpservers.org | Submit |
| MCPmarket.com | Submit |
| PulseMCP | Submit |
| awesomeclaude.ai | Submit |
| Official MCP Registry | Submit when open for GA |

**8. Product Hunt**
- Launch Tuesday-Thursday
- Tagline: "An AI agent with memory, personality, and self-improvement inside Claude Code"
- Maker comment tells the self-fix story

## Pre-Launch Checklist

- [ ] Demo recording -- 60-90 seconds showing the full agent loop: timer fires, agent wakes up with personality, recalls memory, does research, sends Telegram message. Bonus: show the self-improvement moment.
- [ ] README rewrite -- lead with "what it feels like to use" (agent with personality), not "what it does" (feature list). Architecture diagram second.
- [ ] Installation is dead simple -- one npm install, one config file, add to .claude/settings.json. Test fresh install.
- [ ] GitHub presentation -- topics/tags set, description as "Autonomous AI agent with persistent identity for Claude Code", social preview image
- [ ] Architecture diagram -- two diagrams: (1) the identity/personality flow (soul.md -> event loop -> memory -> reflection), (2) the two-process hot-swap architecture
- [ ] License -- MIT for maximum adoption
- [ ] soul.md example -- ship a compelling default personality file that people can customize

## Content Strategy Post-Launch

### Story Hooks
- "My AI agent fixed its own bug" -- the self-improvement narrative, concrete and demonstrable
- "What happens when an AI remembers who it is" -- the identity persistence angle, philosophical + technical
- "30 days with a persistent AI agent" -- longitudinal reflection on accumulated memory and evolving behavior
- "The economics of zero-token idle" -- how the event loop works and what it costs
- "Building a daily competitor intelligence system" -- practical use case (Fric & Frac reports)
- "HomarUScc vs. OpenClaw: choosing the right agent runtime" -- honest comparison content that respects both projects

### Content Calendar
- Week 1: HN launch + r/ClaudeCode
- Week 2: r/mcp + Twitter thread + Discord
- Week 3: dev.to article + directory submissions
- Week 4: Product Hunt + "My AI agent fixed its own bug" post
- Monthly: one post on identity, memory, or self-improvement in practice

## Metrics to Track

- GitHub stars (primary signal, drives directory rankings)
- npm installs (actual adoption)
- GitHub issues/PRs (community engagement)
- Telegram/Discord mentions
- Search ranking for "Claude Code agent" and "Claude Code MCP server"

## Narrative Frames

**Lead with:**
- "An agent, not a tool" -- the identity/personality angle
- "It knows who it is" -- soul.md, persistent identity across sessions
- "It improves itself" -- the self-fix story, two-process architecture
- "Built for myself" -- authentic, the agent runs the builder's actual business tasks
- "Zero-token presence" -- economically viable persistent agent

**Avoid:**
- "AI memory" as primary frame -- Mem0 owns this
- "Swiss Army knife" / "all-in-one" -- generic, forgettable
- Feature lists without narrative -- tools are boring, agents are interesting
- "Revolutionary" / "game-changing" -- will get roasted
- Infrastructure-first framing -- nobody shares architecture diagrams, they share "my AI did this cool thing"
- Trash-talking OpenClaw -- they're more mature in several areas, be honest about it

## Validation

1. Market is real and growing -- MCP ecosystem: 100K to 8M downloads in 6 months, 5,800+ servers, official registry launching
2. Nobody owns "self-improving autonomous agent inside Claude Code" -- tools exist, agents don't. The self-improvement angle is genuinely unique.
3. Community is active and hungry -- r/ClaudeCode 96K members, Discord 60K+, constant "what MCP servers do you use?" posts
4. The self-improvement story is genuinely novel -- no other MCP server (or OpenClaw) can modify and restart itself. This is demonstrable, not theoretical.
5. Real daily usage provides authentic demo material -- competitor intel, Telegram messaging, memory accumulation, bug self-fixes
6. Complementary to OpenClaw -- different deployment model, shared philosophy. Generosity toward OpenClaw builds credibility.

## Risks

- **Anthropic builds it natively** -- if Claude Code gets built-in memory/messaging/scheduling, the window narrows. Speed matters.
- **"Just a bunch of MCP tools" objection** -- counter with the identity/self-improvement story. Tools don't know who they are.
- **"Why not just use OpenClaw?" objection** -- counter honestly: OpenClaw is more capable in several areas. HomarUScc's edge is self-improvement + Claude Code native + zero-token idle + simpler setup. Different tools for different contexts.
- **Memory is less sophisticated than OpenClaw's** -- auto-flush is now implemented. Remaining gaps: temporal decay, MMR re-ranking, and transcript indexing are on the roadmap.
- **Single channel (Telegram)** -- adding more channels would strengthen the "use both" story. At minimum, consider Discord and email.
