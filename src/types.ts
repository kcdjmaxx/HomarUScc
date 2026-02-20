// Shared types for homaruscc — HomarUS for Claude Code
// Trimmed: removed Agent, Model, ChatRequest types (Claude Code handles those)

// --- Events ---

export interface Event {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  payload: unknown;
  replyTo?: string;
  priority?: number;
}

export interface MessagePayload {
  from: string;
  channel: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
  isGroup: boolean;
  isMention: boolean;
  raw: unknown;
}

export interface Attachment {
  type: string;
  url?: string;
  data?: Buffer;
  mimeType?: string;
  filename?: string;
}

export interface OutboundMessage {
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
}

// --- Tools ---

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: unknown, context: ToolContext) => Promise<ToolResult>;
  source: string;
}

export interface ToolContext {
  agentId: string;
  sandbox: boolean;
  workingDir: string;
}

export interface ToolResult {
  output: string;
  error?: string;
}

// --- Skills ---

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  emits?: string[];
  handles?: string[];
  tools?: ToolSchema[];
  process?: {
    command: string;
    args?: string[];
    port?: number;
    healthCheck?: string;
  };
  hooks?: {
    onStart?: string;
    onStop?: string;
    onHealth?: string;
  };
}

export type SkillState = "loaded" | "starting" | "running" | "stopping" | "stopped" | "error";
export type TransportType = "http" | "stdio" | "direct";

// --- Channels ---

export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";
export type GroupPolicy = "mention_required" | "always_on" | "disabled";

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  lastCheck: number;
}

// --- Browser ---

export interface BrowserConfig {
  enabled?: boolean;
  headless?: boolean;
  executablePath?: string;
  proxy?: string;
  viewport?: { width: number; height: number };
  timeout?: number;
  userDataDir?: string;
}

// --- Config (adapted for homaruscc — no models/agents sections) ---

export interface ConfigData {
  channels: Record<string, ChannelConfig>;
  memory: MemoryConfig;
  skills: SkillsConfig;
  dashboard: DashboardConfig;
  timers: TimersConfig;
  identity: IdentityConfig;
  browser?: BrowserConfig;
  toolPolicies?: ToolPolicyConfig[];
}

export interface ChannelConfig {
  token?: string;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  [key: string]: unknown;
}

export interface ToolPolicyConfig {
  name: string;
  allow?: string[];
  deny?: string[];
}

export interface MemoryConfig {
  embedding?: {
    provider: string;
    model: string;
    baseUrl?: string;
    apiKey?: string;
    dimensions?: number;
  };
  search?: { vectorWeight?: number; ftsWeight?: number };
  decay?: {
    enabled?: boolean;
    halfLifeDays?: number;
    evergreenPatterns?: string[];
  };
  extraPaths?: string[];
}

export interface SkillsConfig {
  paths?: string[];
}

export interface DashboardConfig {
  port?: number;
  enabled?: boolean;
}

export interface TimersConfig {
  enabled?: boolean;
  store?: string;
}

export interface IdentityConfig {
  dir?: string;
  workspaceDir?: string;
}

// --- Handlers ---

export type DirectHandler = (event: Event) => void | Promise<void>;

export interface AgentHandlerConfig {
  id: string;
  agentConfig: Record<string, unknown>;
  buildPrompt?: (event: Event) => string;
}

// --- Logging ---

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

// --- Errors ---

export class HomarusccError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "HomarusccError";
  }
}
