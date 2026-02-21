// CRC: crc-McpServer.md
// MCP resource definitions exposed to Claude Code
import type { HomarUScc } from "./homaruscc.js";

export interface McpResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: () => Promise<string>;
}

export function createMcpResources(loop: HomarUScc): McpResourceDef[] {
  return [
    {
      uri: "identity://soul",
      name: "Soul Identity",
      description: "Current soul.md content — core identity and personality",
      mimeType: "text/markdown",
      async handler() {
        return loop.getIdentityManager().getSoul() || "(no soul.md configured)";
      },
    },
    {
      uri: "identity://user",
      name: "User Profile",
      description: "Current user.md content — user preferences and context",
      mimeType: "text/markdown",
      async handler() {
        return loop.getIdentityManager().getUser() || "(no user.md configured)";
      },
    },
    {
      uri: "identity://state",
      name: "Agent State",
      description: "Current state.md — agent mood, recent session context, emotional continuity",
      mimeType: "text/markdown",
      async handler() {
        return loop.getIdentityManager().getAgentState() || "(no state.md — first session)";
      },
    },
    {
      uri: "config://current",
      name: "Current Config",
      description: "Current configuration (secrets redacted)",
      mimeType: "application/json",
      async handler() {
        const config = loop.getConfig().getAll();
        // Redact sensitive fields
        const redacted = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
        const channels = redacted.channels as Record<string, Record<string, unknown>> | undefined;
        if (channels) {
          for (const ch of Object.values(channels)) {
            if (ch.token) ch.token = "***";
          }
        }
        const memory = redacted.memory as Record<string, Record<string, unknown>> | undefined;
        if (memory?.embedding) {
          const emb = memory.embedding as Record<string, unknown>;
          if (emb.apiKey) emb.apiKey = "***";
        }
        return JSON.stringify(redacted, null, 2);
      },
    },
    {
      uri: "events://recent",
      name: "Recent Events",
      description: "Last N events from the event loop",
      mimeType: "application/json",
      async handler() {
        const events = loop.getEventHistory().slice(-20);
        return JSON.stringify(events, null, 2);
      },
    },
  ];
}
